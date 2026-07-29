import { spawn, type ChildProcess } from 'node:child_process';
import type { ActionContext } from '@tools/shared';

export type RuntimeId = 'powershell' | 'cmd' | 'bash' | 'sh' | 'python' | 'node';

export interface RunRequest {
  runtime: RuntimeId;
  inline?: string;
  path?: string;
  args: Record<string, string>;
  env: Record<string, string>;
  cwd?: string;
  timeoutMs: number;
  parseJsonOutput: boolean;
}

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  data?: unknown;
  parseWarning?: string;
  timedOut: boolean;
  durationMs: number;
}

interface RuntimeSpec {
  command: string;
  inlineArgs: string[]; // 内联模式参数（脚本内容追加在末尾）
  fileArgs: string[]; // 文件模式参数（路径追加在末尾）
}

/** 各运行时的解释器与调用方式。用 args 数组 + shell:false，避免 shell 转义问题。 */
const RUNTIMES: Record<RuntimeId, RuntimeSpec> = {
  powershell: { command: 'powershell.exe', inlineArgs: ['-NoProfile', '-NonInteractive', '-Command'], fileArgs: ['-NoProfile', '-NonInteractive', '-File'] },
  cmd: { command: 'cmd.exe', inlineArgs: ['/c'], fileArgs: ['/c'] },
  bash: { command: 'bash', inlineArgs: ['-c'], fileArgs: [] },
  sh: { command: 'sh', inlineArgs: ['-c'], fileArgs: [] },
  python: { command: 'python', inlineArgs: ['-c'], fileArgs: [] },
  node: { command: 'node', inlineArgs: ['-e'], fileArgs: [] },
};

type CtxLog = ActionContext['log'];

/** 在平台宿主机本地执行一段脚本。纯执行逻辑，不含权限/白名单判断（由适配器负责）。 */
export function runScript(req: RunRequest, log?: CtxLog): Promise<RunResult> {
  return new Promise((resolve) => {
    const spec = RUNTIMES[req.runtime];
    const useFile = !!req.path && req.path.length > 0;
    const args = useFile
      ? [...spec.fileArgs, req.path as string]
      : [...spec.inlineArgs, req.inline ?? ''];

    // env 直接合并；args 以 ARG_<KEY> 环境变量注入（跨运行时统一）
    const childEnv: NodeJS.ProcessEnv = { ...process.env };
    for (const [k, v] of Object.entries(req.env)) childEnv[k] = v;
    for (const [k, v] of Object.entries(req.args)) childEnv[`ARG_${k}`] = v;

    const startedAt = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    let child: ChildProcess;
    try {
      child = spawn(spec.command, args, {
        cwd: req.cwd,
        env: childEnv,
        windowsHide: true,
        shell: false,
      });
    } catch (err) {
      resolve({
        exitCode: -1,
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err),
        timedOut: false,
        durationMs: Date.now() - startedAt,
      });
      return;
    }

    child.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, req.timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      resolve({ exitCode: -1, stdout, stderr: stderr ? `${stderr}\n${msg}` : msg, timedOut, durationMs: Date.now() - startedAt });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startedAt;
      let data: unknown;
      let parseWarning: string | undefined;
      if (req.parseJsonOutput && !timedOut) {
        const lines = stdout.split(/\r?\n/).filter((l) => l.trim().length > 0);
        const last = lines[lines.length - 1];
        if (last) {
          try {
            data = JSON.parse(last);
          } catch {
            parseWarning = 'PARSE_OUTPUT_FAILED';
            log?.('warn', 'parseJsonOutput 解析失败（仅警告，不影响 ok）');
          }
        }
      }
      resolve({
        exitCode: code ?? (timedOut ? -1 : 0),
        stdout,
        stderr,
        data,
        parseWarning,
        timedOut,
        durationMs,
      });
    });
  });
}
