import { forwardRef, Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { ActionBus, AdapterEvent, LinkageRule } from '@tools/shared';
import type { AuthUser } from '../platform/auth/auth.types';
import { PrismaService } from '../platform/prisma/prisma.service';
import { ActionService } from './action.service';

/** 联动触发使用的系统主体（admin 配置的规则，视作可信、旁路 RBAC）。 */
const SYSTEM_USER: AuthUser = { id: 'system', username: 'system', isAdmin: true };

/**
 * ActionBusService —— 平台 Action Bus 实现：持久化联动规则 + 事件派发。
 * emit 时：通知本地监听器，并对每条匹配规则异步触发目标 Action（以 SYSTEM_USER 身份，
 * 且 suppressEmit=true 以避免无限递归——联动为单跳）。
 */
@Injectable()
export class ActionBusService implements ActionBus, OnApplicationBootstrap {
  private readonly logger = new Logger(ActionBusService.name);
  private readonly listeners = new Map<string, Array<(payload: unknown) => void>>();
  private rules: LinkageRule[] = [];

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ActionService)) private readonly actions: ActionService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.reload();
  }

  /** CRUD 后调用以重载规则。 */
  async refresh(): Promise<void> {
    await this.reload();
  }

  private async reload(): Promise<void> {
    const rows = await this.prisma.linkageRule.findMany({ where: { enabled: true } });
    this.rules = rows.map((r) => ({
      id: r.id,
      sourceEventId: r.sourceEventId,
      targetActionId: r.targetActionId,
      mode: r.mode === 'static' ? 'static' : 'passthrough',
      targetInput: r.targetInput ? safeParse(r.targetInput) : undefined,
      enabled: r.enabled,
    }));
    this.logger.log(`loaded ${this.rules.length} enabled linkage rule(s)`);
  }

  on(eventId: string, listener: (payload: unknown) => void): void {
    const list = this.listeners.get(eventId) ?? [];
    list.push(listener);
    this.listeners.set(eventId, list);
  }

  addRule(rule: LinkageRule): void {
    this.rules.push(rule);
  }

  async emit(event: AdapterEvent): Promise<void> {
    for (const listener of this.listeners.get(event.id) ?? []) {
      try {
        listener(event.payload);
      } catch (e) {
        this.logger.error(`listener for ${event.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    const matched = this.rules.filter((r) => r.sourceEventId === event.id && r.enabled !== false);
    for (const rule of matched) {
      const input = rule.mode === 'static' ? rule.targetInput : event.payload;
      this.actions
        .run(rule.targetActionId, input, SYSTEM_USER, { suppressEmit: true })
        .catch((e) =>
          this.logger.error(
            `linkage ${event.id} -> ${rule.targetActionId} failed: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
    }
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}
