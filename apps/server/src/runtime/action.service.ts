import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ActionContext, ActionResult } from '@tools/shared';
import { fail } from '@tools/shared';
import type { AuthUser } from '../platform/auth/auth.types';
import { RbacService } from '../platform/rbac/rbac.service';
import { AuditService } from '../platform/audit/audit.service';
import { NotificationService } from '../platform/notify/notification.service';
import { ActionBusService } from './action-bus.service';
import { AdapterRegistry } from './adapter-registry';

/**
 * ActionService —— 执行 Action 的唯一入口，也是"授权 + 审计"的统一咽喉。
 * 流程：查表 → RBAC(isAdmin 旁路) → zod 校验 → handler → 写审计(回填 auditLogId)。
 */
@Injectable()
export class ActionService {
  private readonly logger = new Logger(ActionService.name);

  constructor(
    private readonly registry: AdapterRegistry,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
    private readonly notify: NotificationService,
    private readonly actionBus: ActionBusService,
  ) {}

  async run(
    actionId: string,
    rawInput: unknown,
    principal: AuthUser,
    opts: { suppressEmit?: boolean } = {},
  ): Promise<ActionResult> {
    const registration = this.registry.get(actionId);
    if (!registration) {
      return fail('ACTION_NOT_FOUND', `未注册的 Action: ${actionId}`);
    }

    // 授权切点
    const allowed = principal.isAdmin || (await this.rbac.isAuthorized(principal.id, actionId));
    if (!allowed) {
      const auditLogId = await this.audit.record({
        principal: principal.id,
        actionId,
        ok: false,
        errorCode: 'FORBIDDEN',
        durationMs: 0,
        denied: true,
      });
      return fail('FORBIDDEN', `无权限调用 ${actionId}`, { auditLogId });
    }

    const parsed = registration.action.inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const auditLogId = await this.audit.record({
        principal: principal.id,
        actionId,
        ok: false,
        errorCode: 'INVALID_INPUT',
        durationMs: 0,
        inputDigest: this.audit.digest(rawInput),
      });
      return fail('INVALID_INPUT', '输入参数校验失败', {
        validation: parsed.error.flatten(),
        auditLogId,
      });
    }

    const ctx: ActionContext = {
      principal: principal.id,
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
      const durationMs = finishedAt.getTime() - startedAt.getTime();
      const auditLogId = await this.audit.record({
        principal: principal.id,
        actionId,
        ok: result.ok,
        errorCode: result.error?.code,
        durationMs,
        inputDigest: this.audit.digest(parsed.data),
        correlationId: ctx.correlationId,
      });
      if (!opts.suppressEmit) {
        void this.actionBus
          .emit({
            id: result.ok ? `action.${actionId}.succeeded` : `action.${actionId}.failed`,
            name: actionId,
            payload: { actionId, ok: result.ok, errorCode: result.error?.code, correlationId: ctx.correlationId },
          })
          .catch(() => undefined);
      }
      return {
        ...result,
        meta: {
          ...(result.meta ?? ({} as ActionResult['meta'])),
          actionId,
          auditLogId,
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationMs,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[${actionId}] handler threw: ${message}`);
      const finishedAt = new Date();
      const auditLogId = await this.audit.record({
        principal: principal.id,
        actionId,
        ok: false,
        errorCode: 'HANDLER_ERROR',
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        correlationId: ctx.correlationId,
      });
      void this.notify
        .notify({
          event: 'action.error',
          level: 'error',
          title: `Action 执行失败: ${actionId}`,
          message,
          meta: { actionId, principal: principal.id, correlationId: ctx.correlationId },
          createdAt: finishedAt.toISOString(),
        })
        .catch(() => undefined);
      if (!opts.suppressEmit) {
        void this.actionBus
          .emit({
            id: `action.${actionId}.failed`,
            name: actionId,
            payload: { actionId, ok: false, errorCode: 'HANDLER_ERROR', correlationId: ctx.correlationId },
          })
          .catch(() => undefined);
      }
      return fail('HANDLER_ERROR', message, { auditLogId });
    }
  }
}
