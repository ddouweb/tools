import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { Adapter } from '@ai-tool/shared';
import { AdapterRegistry } from './adapter-registry';

/**
 * AdapterBootstrap — 应用启动时把所有适配器注册进 AdapterRegistry。
 * 新增适配器：实现 Adapter，加入 'ADAPTERS' token 的工厂列表即可，无需改动核心。
 */
@Injectable()
export class AdapterBootstrap implements OnModuleInit {
  constructor(
    private readonly registry: AdapterRegistry,
    @Inject('ADAPTERS') private readonly adapters: Adapter[],
  ) {}

  async onModuleInit(): Promise<void> {
    for (const adapter of this.adapters) {
      await adapter.onInit?.();
      this.registry.register(adapter);
    }
  }
}
