import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AdapterRegistry } from './runtime/adapter-registry';
import { ActionService } from './runtime/action.service';

/**
 * 根控制器：健康检查 + 通用 Action 调用入口。
 * POST /actions/:actionId/invoke 同时是"被接入"能力的起点——外部系统经鉴权后可触发 visibility=public 的 Action。
 * （鉴权/RBAC 尚未实现，principal 暂取 anonymous，待 platform-core spec 落地后接入。）
 */
@Controller()
export class AppController {
  constructor(
    private readonly registry: AdapterRegistry,
    private readonly actions: ActionService,
  ) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      adapters: this.registry.listAdapters(),
      actions: this.registry.listActions().map((a) => ({
        id: a.id,
        name: a.name,
        visibility: a.visibility ?? 'internal',
        tags: a.tags ?? [],
      })),
    };
  }

  @Post('actions/:actionId/invoke')
  async invoke(@Param('actionId') actionId: string, @Body() body: unknown, @Req() req: Request) {
    const principal = (req as unknown as { user?: { id?: string } }).user?.id ?? 'anonymous';
    return this.actions.run(actionId, body, principal);
  }
}
