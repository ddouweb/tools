import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public, type AuthUser } from './platform/auth/auth.types';
import { AdapterRegistry } from './runtime/adapter-registry';
import { ActionService } from './runtime/action.service';

/**
 * 根控制器：健康检查（公开）+ 通用 Action 调用入口（受 AuthGuard 保护）。
 * 外部系统可凭 API Token 调 visibility=public 的 Action（鉴权与 RBAC 统一在 ActionService 切点）。
 */
@Controller()
export class AppController {
  constructor(
    private readonly registry: AdapterRegistry,
    private readonly actions: ActionService,
  ) {}

  @Public()
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
    const user = (req as unknown as { user: AuthUser }).user;
    return this.actions.run(actionId, body, user);
  }
}
