import type {
  ActionContext,
  ActionDefinition,
  ActionHandler,
  ActionResult,
  InferInput,
  InferOutput,
} from './action';

/**
 * Adapter — 每一个工具集成实现为一个适配器。
 * 新增工具 = 新增一个 Adapter 实现并向核心注册其 Action；不要把工具逻辑写进核心。
 */

export interface AdapterManifest {
  /** 全局唯一适配器 id，例如 'ssh' / 'script' / 'jenkins' */
  id: string;
  name: string;
  description?: string;
  version: string;
}

/** 适配器向核心注册的一条（Action + handler）记录。 */
export interface AdapterActionRegistration {
  action: ActionDefinition;
  handler: ActionHandler;
}

/** 类型安全的注册记录：handler 的入参/返回与 Action 的 schema 自动对齐。 */
export interface TypedRegistration<A extends ActionDefinition> {
  action: A;
  handler: (input: InferInput<A>, ctx: ActionContext) => Promise<ActionResult<InferOutput<A>>>;
}

/** 所有适配器必须实现的接口。 */
export interface Adapter {
  readonly manifest: AdapterManifest;
  /** 平台启动时调用一次，返回该适配器提供的全部 Action 注册项 */
  register(): AdapterActionRegistration[];
  /** 可选生命周期钩子 */
  onInit?: () => Promise<void>;
  onDestroy?: () => Promise<void>;
}

/** 辅助：把一条 TypedRegistration（带强类型 handler）放宽为核心需要的注册项。 */
export function reg<A extends ActionDefinition>(r: TypedRegistration<A>): AdapterActionRegistration {
  return { action: r.action, handler: r.handler as ActionHandler };
}
