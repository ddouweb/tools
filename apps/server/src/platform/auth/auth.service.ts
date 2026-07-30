import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './auth.types';

const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
const REFRESH_TTL = process.env.JWT_REFRESH_TTL || '7d';

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

function ttlMs(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!m) return 7 * 24 * 3600 * 1000;
  const n = Number(m[1]);
  const unit = m[2];
  const mult = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  return n * mult;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private async isAdmin(userId: string): Promise<boolean> {
    const r = await this.prisma.userRole.findFirst({
      where: { userId, role: { isAdmin: true } },
    });
    return !!r;
  }

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('账号或密码错误');
    }
    const ok = await verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('账号或密码错误');
    const isAdmin = await this.isAdmin(user.id);
    return this.issueTokens(user.id, user.username, isAdmin);
  }

  async refresh(refreshToken: string) {
    let payload: { sub?: string; type?: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken);
    } catch {
      throw new UnauthorizedException('refresh 无效');
    }
    if (payload?.type !== 'refresh' || !payload.sub) {
      throw new UnauthorizedException('refresh 无效');
    }
    const rec = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
    });
    if (!rec || rec.revokedAt || rec.expiresAt < new Date()) {
      throw new UnauthorizedException('refresh 已失效');
    }
    // 轮换：吊销旧 refresh
    await this.prisma.refreshToken.update({
      where: { id: rec.id },
      data: { revokedAt: new Date() },
    });
    const user = await this.prisma.user.findUnique({ where: { id: rec.userId } });
    if (!user || user.status !== 'active') throw new UnauthorizedException();
    const isAdmin = await this.isAdmin(user.id);
    return this.issueTokens(user.id, user.username, isAdmin);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const isAdmin = await this.isAdmin(userId);
    return { id: user.id, username: user.username, email: user.email, isAdmin };
  }

  /** 创建 API Token（外部系统接入用）；明文仅返回一次，库内只存哈希。 */
  async createApiToken(userId: string, name: string) {
    const raw = `tok_${randomBytes(24).toString('base64url')}`;
    await this.prisma.apiToken.create({
      data: { userId, name, tokenHash: sha256(raw) },
    });
    return { token: raw, name };
  }

  async resolveApiToken(raw: string): Promise<AuthUser | null> {
    if (!raw.startsWith('tok_')) return null;
    const rec = await this.prisma.apiToken.findUnique({
      where: { tokenHash: sha256(raw) },
    });
    if (!rec || rec.revokedAt || (rec.expiresAt && rec.expiresAt < new Date())) return null;
    const user = await this.prisma.user.findUnique({ where: { id: rec.userId } });
    if (!user || user.status !== 'active') return null;
    await this.prisma.apiToken.update({
      where: { id: rec.id },
      data: { lastUsedAt: new Date() },
    });
    return { id: user.id, username: user.username, isAdmin: await this.isAdmin(user.id) };
  }

  /** 鉴别一个 Bearer token：先试 JWT access，再试 API Token。 */
  async authenticate(token: string): Promise<AuthUser | null> {
    try {
      const payload = await this.jwt.verifyAsync(token);
      if (payload && payload.sub && payload.type !== 'refresh') {
        return { id: payload.sub, username: payload.username, isAdmin: !!payload.isAdmin };
      }
    } catch {
      // 非 access JWT，转试 API Token
    }
    return this.resolveApiToken(token);
  }

  private async issueTokens(userId: string, username: string, isAdmin: boolean) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, username, isAdmin },
      { expiresIn: Math.round(ttlMs(ACCESS_TTL) / 1000) },
    );
    // 先建行拿到 id 作为 jti，再用其哈希回填，实现可吊销/轮换
    const rt = await this.prisma.refreshToken.create({
      data: { userId, tokenHash: 'pending', expiresAt: new Date(Date.now() + ttlMs(REFRESH_TTL)) },
    });
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, type: 'refresh', jti: rt.id },
      { expiresIn: Math.round(ttlMs(REFRESH_TTL) / 1000) },
    );
    await this.prisma.refreshToken.update({
      where: { id: rt.id },
      data: { tokenHash: sha256(refreshToken) },
    });
    return { accessToken, refreshToken, user: { id: userId, username, isAdmin } };
  }
}
