import { isAbsolute, relative, resolve } from 'node:path';

export const SCRIPT_CONFIG = 'SCRIPT_CONFIG';

export interface ScriptAdapterConfig {
  /** 允许的运行时白名单（默认最小：仅 node） */
  allowedRuntimes: string[];
  /** 允许按路径执行的目录白名单；为空则禁止按路径执行（仅允许内联） */
  allowedScriptDirs: string[];
  /** timeoutMs 的全局上限 */
  maxTimeoutMs: number;
}

/** 从环境变量读取配置，未设置时给出安全默认（默认最小开放）。 */
export function scriptConfigFromEnv(): ScriptAdapterConfig {
  const allowedRuntimes = (process.env.SCRIPT_ALLOWED_RUNTIMES ?? 'node')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowedScriptDirs = (process.env.SCRIPT_ALLOWED_DIRS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const maxTimeoutMs = Number(process.env.SCRIPT_MAX_TIMEOUT_MS ?? 600_000);
  return { allowedRuntimes, allowedScriptDirs, maxTimeoutMs };
}

/** 判断路径是否落在某个允许目录内（含子目录）。允许目录为空时一律拒绝。 */
export function withinAllowed(p: string, dirs: string[]): boolean {
  if (dirs.length === 0) return false;
  const abs = resolve(p);
  return dirs.some((d) => {
    const base = resolve(d);
    const rel = relative(base, abs);
    return !!rel && !rel.startsWith('..') && !isAbsolute(rel);
  });
}
