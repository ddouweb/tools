import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { PrismaService } from '../prisma/prisma.service';

interface SafeUser {
  id: string;
  username: string;
  email: string | null;
  status: string;
  roles: { id: string; name: string; isAdmin: boolean }[];
}

/** RBAC 管理 + 审计查询（阶段二）。 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------- users ----------------
  async listUsers(): Promise<SafeUser[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: { roles: { include: { role: true } } },
    });
    return users.map((u) => this.safeUser(u));
  }

  async createUser(dto: {
    username: string;
    password: string;
    email?: string;
    roleIds?: string[];
  }): Promise<SafeUser> {
    if (!dto.username || !dto.password) throw new BadRequestException('username/password 必填');
    if (await this.prisma.user.findUnique({ where: { username: dto.username } })) {
      throw new BadRequestException('用户名已存在');
    }
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash: await hash(dto.password),
        email: dto.email,
        roles: dto.roleIds?.length
          ? { create: dto.roleIds.map((roleId) => ({ roleId })) }
          : undefined,
      },
      include: { roles: { include: { role: true } } },
    });
    return this.safeUser(user);
  }

  async updateUser(
    id: string,
    dto: { email?: string; status?: string; password?: string },
  ): Promise<SafeUser> {
    const data: Prisma.UserUpdateInput = {};
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.password) data.passwordHash = await hash(dto.password);
    try {
      const u = await this.prisma.user.update({
        where: { id },
        data,
        include: { roles: { include: { role: true } } },
      });
      return this.safeUser(u);
    } catch {
      throw new NotFoundException('用户不存在');
    }
  }

  async deleteUser(id: string): Promise<{ id: string }> {
    try {
      await this.prisma.user.delete({ where: { id } });
      return { id };
    } catch {
      throw new NotFoundException('用户不存在');
    }
  }

  async setUserRoles(id: string, roleIds: string[]): Promise<SafeUser> {
    if (!(await this.prisma.user.findUnique({ where: { id } }))) {
      throw new NotFoundException('用户不存在');
    }
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId: id } }),
      this.prisma.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId: id, roleId })),
      }),
    ]);
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    return this.safeUser(u!);
  }

  // ---------------- roles ----------------
  listRoles() {
    return this.prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
  }

  async createRole(dto: { name: string; description?: string; isAdmin?: boolean }) {
    if (!dto.name) throw new BadRequestException('name 必填');
    if (await this.prisma.role.findUnique({ where: { name: dto.name } })) {
      throw new BadRequestException('角色名已存在');
    }
    return this.prisma.role.create({
      data: { name: dto.name, description: dto.description, isAdmin: dto.isAdmin },
      include: { permissions: { include: { permission: true } } },
    });
  }

  async updateRole(
    id: string,
    dto: { name?: string; description?: string; isAdmin?: boolean },
  ) {
    const data: Prisma.RoleUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isAdmin !== undefined) data.isAdmin = dto.isAdmin;
    try {
      return this.prisma.role.update({
        where: { id },
        data,
        include: { permissions: { include: { permission: true } } },
      });
    } catch {
      throw new NotFoundException('角色不存在');
    }
  }

  async deleteRole(id: string): Promise<{ id: string }> {
    try {
      await this.prisma.role.delete({ where: { id } });
      return { id };
    } catch {
      throw new NotFoundException('角色不存在');
    }
  }

  async setRolePermissions(id: string, permissionIds: string[]) {
    if (!(await this.prisma.role.findUnique({ where: { id } }))) {
      throw new NotFoundException('角色不存在');
    }
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
      }),
    ]);
    return this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
  }

  // ---------------- permissions ----------------
  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
  }

  createPermission(key: string) {
    if (!key) throw new BadRequestException('key 必填');
    return this.prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  }

  // ---------------- audit ----------------
  async queryAudit(filters: {
    actionId?: string;
    principal?: string;
    denied?: string;
    ok?: string;
    from?: string;
    to?: string;
    page?: string;
    pageSize?: string;
  }) {
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.actionId) where.actionId = filters.actionId;
    if (filters.principal) where.principal = filters.principal;
    if (filters.denied !== undefined) where.denied = filters.denied === 'true';
    if (filters.ok !== undefined) where.ok = filters.ok === 'true';
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(filters.from);
      if (filters.to) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(filters.to);
    }
    const page = Number(filters.page ?? 1) || 1;
    const pageSize = Math.min(Number(filters.pageSize ?? 50) || 50, 200);
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  private safeUser(u: {
    id: string;
    username: string;
    email: string | null;
    status: string;
    roles: { role: { id: string; name: string; isAdmin: boolean } }[];
  }): SafeUser {
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      status: u.status,
      roles: u.roles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
        isAdmin: ur.role.isAdmin,
      })),
    };
  }
}
