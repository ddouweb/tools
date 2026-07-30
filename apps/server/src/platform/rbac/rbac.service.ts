import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth.types';

/**
 * RbacService —— Action 级授权。
 * 主体有效权限 = 其所有角色的权限并集；命中即放行。支持通配：
 *   action:<id>（精确）/ action:<adapter>.*（适配器级）/ action:*（全部）
 * 超级管理员（role.isAdmin）直接放行。
 */
@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async isAuthorized(userId: string, actionId: string): Promise<boolean> {
    const urs = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    for (const ur of urs) {
      if (ur.role.isAdmin) return true;
      for (const rp of ur.role.permissions) {
        if (matchPermission(rp.permission.key, actionId)) return true;
      }
    }
    return false;
  }

  /** 依据 userId 构造 AuthUser（含 isAdmin），供任务/调度等异步执行时还原主体。 */
  async getAuthUser(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { id: userId, username: 'unknown', isAdmin: false };
    const admin = await this.prisma.userRole.findFirst({
      where: { userId, role: { isAdmin: true } },
    });
    return { id: user.id, username: user.username, isAdmin: !!admin };
  }
}

function matchPermission(key: string, actionId: string): boolean {
  const required = `action:${actionId}`;
  if (key === required || key === 'action:*') return true;
  if (key.endsWith('.*')) {
    const prefix = key.slice(0, -2); // 如 action:script
    if (required.startsWith(`${prefix}.`)) return true;
  }
  return false;
}
