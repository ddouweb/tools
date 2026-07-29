import { Injectable } from '@nestjs/common';
import type {
  Adapter,
  AdapterManifest,
  ActionDefinition,
  ActionHandler,
} from '@tools/shared';

interface RegisteredAction {
  action: ActionDefinition;
  handler: ActionHandler;
  adapterId: string;
}

/**
 * AdapterRegistry — 适配器/动作的中央索引。
 * 启动时由 AdapterBootstrap 把所有适配器的 Action 注册进来；
 * 运行时 ActionService / 控制器通过它查找动作、列举能力（供 RBAC、API 文档、前端展示）。
 */
@Injectable()
export class AdapterRegistry {
  private readonly actions = new Map<string, RegisteredAction>();
  private readonly adapters = new Map<string, AdapterManifest>();

  /** 注册一个适配器及其全部 Action。重复 id 会直接抛错（fail fast）。 */
  register(adapter: Adapter): void {
    const { id } = adapter.manifest;
    if (this.adapters.has(id)) {
      throw new Error(`Adapter already registered: ${id}`);
    }
    this.adapters.set(id, adapter.manifest);
    for (const r of adapter.register()) {
      if (this.actions.has(r.action.id)) {
        throw new Error(`Action id already registered: ${r.action.id}`);
      }
      this.actions.set(r.action.id, {
        action: r.action,
        handler: r.handler,
        adapterId: id,
      });
    }
  }

  get(actionId: string): RegisteredAction | undefined {
    return this.actions.get(actionId);
  }

  listActions(): ActionDefinition[] {
    return [...this.actions.values()].map((v) => v.action);
  }

  listAdapters(): AdapterManifest[] {
    return [...this.adapters.values()];
  }
}
