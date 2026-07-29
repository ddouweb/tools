import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ActionContext, ActionResult } from '@tools/shared';
import { fail } from '@tools/shared';
import { AdapterRegistry } from './adapter-registry';

/**
 * ActionService — 执行 Action 的唯一入口。
 * 职责：查表 -> 校验输入(zod) -> 构造上下文 -> 调用 handler -> 补充执行元信息。
 * 这里也是后续接入"审计日志/权限校验"的统一切点（platform-core 落地后补）。
 */
@Injectable()
export class ActionService {
  private readonly logger = new Logger(ActionService.name);

  constructor(@Inject(AdapterRegistry) private readonly registry: AdapterRegistry) {}

  async run(actionId: string, rawInput: unknown, principal: string): Promise<ActionResult> {
    const registration = this.registry.get(actionId);
    if (!registration) {
      return fail('ACTION_NOT_FOUND', `未注册的 Action: ${actionId}`);
    }

    const parsed = registration.action.inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return fail('INVALID_INPUT', '输入参数校验失败', parsed.error.flatten());
    }

    const ctx: ActionContext = {
      principal,
      correlationId: randomUUID(),
      log: (level, msg, fields) => {
        const text = fields
          ? `[${actionId}] ${msg} ${JSON.stringify(fields)}`
          : `[${actionId}] ${msg}`;
        if (level === 'info') this.logger.log(text);
        else if (level === 'warn') this.logger.warn(text);
        else this.logger.error(text);
      },
    };

    const startedAt = new Date();
    try {
      const result = await registration.handler(parsed.data, ctx);
      const finishedAt = new Date();
      return {
        ...result,
        meta: {
          ...(result.meta ?? ({} as ActionResult['meta'])),
          actionId,
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationMs: finishedAt.getTime() - startedAt.getTime(),
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[${actionId}] handler threw: ${message}`);
      return fail('HANDLER_ERROR', message);
    }
  }
}
