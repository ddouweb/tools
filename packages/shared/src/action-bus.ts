/**
 * Action Bus —— 跨工具"关联操作"的声明式机制。
 * 适配器/平台 emit 事件；LinkageRule 把事件路由到其它 Action。
 */

export type LinkageMode = 'passthrough' | 'static';

/** 适配器/平台发出的事件。 */
export interface AdapterEvent {
  /** 全局唯一事件 id，例如 'action.script.run.failed' / 'jenkins.build-failed' */
  id: string;
  name: string;
  payload?: unknown;
}

/** 联动规则（可持久化）：某事件 -> 触发某 Action。 */
export interface LinkageRule {
  id: string;
  /** 触发源事件 id */
  sourceEventId: string;
  /** 目标 Action id */
  targetActionId: string;
  /** passthrough: 用事件 payload 作目标输入；static: 用 targetInput。默认 passthrough */
  mode?: LinkageMode;
  /** mode=static 时的固定目标输入（JSON） */
  targetInput?: unknown;
  enabled?: boolean;
}

/** 平台 Action Bus 需实现的契约。 */
export interface ActionBus {
  /** 本地监听某事件（适配器内部使用） */
  on(eventId: string, listener: (payload: unknown) => void): void;
  /** 发射事件，触发所有匹配的联动规则（规则内异步调用目标 Action） */
  emit(event: AdapterEvent): Promise<void>;
  /** 注册一条联动规则 */
  addRule(rule: LinkageRule): void;
}
