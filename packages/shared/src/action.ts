import { z } from 'zod';

/**
 * Action — 一个适配器暴露给平台的能力单元。
 * 所有工具能力都以 Action 形式注册；RBAC 授权与审计日志均以 Action 为粒度。
 */

/** visibility 决定该 Action 能否被外部系统经 inbound API 触发（实现"被接入"）。 */
export const ActionVisibility = z.enum(['internal', 'public']);
export type ActionVisibility = z.infer<typeof ActionVisibility>;

/**
 * Action 的声明（静态描述）。输入/输出用 zod schema 定义，同时作为：
 *  - 运行时校验
 *  - TypeScript 类型推导来源
 *  - 对外文档/SDK 的契约
 */
export interface ActionDefinition<
  TInput extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput extends z.ZodTypeAny = z.ZodTypeAny,
> {
  /** 全局唯一 id，约定 '<adapter>.<verb>'，例如 'script.run-local' */
  id: string;
  name: string;
  description?: string;
  /** 分类/权限分组用的标签 */
  tags?: string[];
  /** 'public' 可被外部系统调用；默认 'internal' */
  visibility?: ActionVisibility;
  inputSchema: TInput;
  outputSchema: TOutput;
}

export type InferInput<A extends ActionDefinition> = z.infer<A['inputSchema']>;
export type InferOutput<A extends ActionDefinition> = z.infer<A['outputSchema']>;

/** Action 执行结果的统一外壳。 */
export interface ActionResult<TOutput = unknown> {
  ok: boolean;
  data?: TOutput;
  error?: ActionError;
  meta?: ActionResultMeta;
}

export interface ActionError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ActionResultMeta {
  actionId: string;
  startedAt: string; // ISO 8601
  finishedAt: string; // ISO 8601
  durationMs: number;
  /** 关联的审计日志条目 id */
  auditLogId?: string;
}

/** 运行时绑定的一次执行上下文，传给 handler。 */
export interface ActionContext {
  /** 已认证主体 id（用户、'system' 或外部调用方标识） */
  principal: string;
  /** 一次调用链路的关联 id，用于日志追踪 */
  correlationId: string;
  /** 限定本次调用的日志方法 */
  log: (level: 'info' | 'warn' | 'error', msg: string, fields?: Record<string, unknown>) => void;
}

/** 已校验输入 -> 结果 的运行时处理器。 */
export type ActionHandler<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  ctx: ActionContext,
) => Promise<ActionResult<TOutput>>;

/** 工具函数：构造成功结果 */
export function ok<TOutput>(data: TOutput, meta?: Partial<ActionResultMeta>): ActionResult<TOutput> {
  return { ok: true, data, meta: meta as ActionResultMeta | undefined };
}

/** 工具函数：构造失败结果 */
export function fail(
  code: string,
  message: string,
  details?: unknown,
): ActionResult<never> {
  return { ok: false, error: { code, message, details } };
}
