import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';
import { AdapterRegistry } from './adapter-registry';

/**
 * 启动后把所有已注册 Action 同步为 Permission（key=action:<id>），
 * 使管理后台可直接为角色分配这些权限，无需手动建。幂等 upsert。
 * 放在 RuntimeModule（持有 AdapterRegistry），避免与 PlatformModule 形成循环依赖。
 */
@Injectable()
export class PermissionSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PermissionSyncService.name);

  constructor(
    private readonly registry: AdapterRegistry,
    private readonly prisma: PrismaService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const actions = this.registry.listActions();
    for (const a of actions) {
      await this.prisma.permission.upsert({
        where: { key: `action:${a.id}` },
        update: {},
        create: { key: `action:${a.id}` },
      });
    }
    this.logger.log(`synced ${actions.length} action(s) as permissions`);
  }
}
