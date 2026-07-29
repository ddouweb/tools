import { Injectable, Logger } from '@nestjs/common';
import type { ActionBus, AdapterEvent, LinkageRule } from '@ai-tool/shared';
import { ActionService } from './action.service';

/**
 * ActionBusService — Action Bus 的平台实现。
 * 跨工具联动一律走这里：适配器 emit 事件 -> 命中的 LinkageRule 异步触发目标 Action。
 * 禁止适配器之间直接调用。
 *
 * 注意：规则触发采用 fire-and-forget（错误仅记日志），避免一个慢动作阻塞事件发射；
 * 若需要可靠投递，后续 platform-core 可在此接入任务队列。
 */
@Injectable()
export class ActionBusService implements ActionBus {
  private readonly logger = new Logger(ActionBusService.name);
  private readonly listeners = new Map<string, Array<(payload: unknown) => void>>();
  private readonly rules = new Map<string, LinkageRule[]>();

  constructor(private readonly actions: ActionService) {}

  on(eventId: string, listener: (payload: unknown) => void): void {
    const list = this.listeners.get(eventId) ?? [];
    list.push(listener);
    this.listeners.set(eventId, list);
  }

  addRule(rule: LinkageRule): void {
    const list = this.rules.get(rule.sourceEventId) ?? [];
    list.push(rule);
    this.rules.set(rule.sourceEventId, list);
    this.logger.log(`linkage rule added: ${rule.sourceEventId} -> ${rule.targetActionId}`);
  }

  async emit(event: AdapterEvent): Promise<void> {
    // 1) 本地监听器（同步通知）
    for (const listener of this.listeners.get(event.id) ?? []) {
      try {
        listener(event.payload);
      } catch (err) {
        this.logger.error(`listener for ${event.id} threw: ${String(err)}`);
      }
    }

    // 2) 联动规则 -> 异步触发目标 Action
    for (const rule of this.rules.get(event.id) ?? []) {
      if (rule.enabled === false) continue;
      const input = rule.map(event.payload);
      this.actions
        .run(rule.targetActionId, input, 'system')
        .catch((err) =>
          this.logger.error(
            `linkage ${event.id} -> ${rule.targetActionId} failed: ${String(err)}`,
          ),
        );
    }
  }
}
