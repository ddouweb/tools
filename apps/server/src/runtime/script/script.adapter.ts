import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { ActionContext, ActionResult, Adapter } from '@tools/shared';
import { fail, ok, reg } from '@tools/shared';
import { SCRIPT_CONFIG, withinAllowed, type ScriptAdapterConfig } from './script.config';
import { runScript } from './runtimes';

const runInput = z.object({
  runtime: z.enum(['powershell', 'cmd', 'bash', 'sh', 'python', 'node']),
  source: z.union([z.object({ inline: z.string().min(1) }), z.object({ path: z.string().min(1) })]),
  args: z.record(z.string(), z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  cwd: z.string().optional(),
  timeoutMs: z.number().int().positive().max(600_000).default(60_000),
  parseJsonOutput: z.boolean().default(false),
});
type RunInput = z.infer<typeof runInput>;

const runOutput = z.object({
  exitCode: z.number().int(),
  stdout: z.string(),
  stderr: z.string(),
  data: z.unknown().optional(),
  timedOut: z.boolean(),
  durationMs: z.number(),
});
type RunOutput = z.infer<typeof runOutput>;

/**
 * ScriptAdapter —— 在平台宿主机本地执行各类脚本（多运行时）。
 * 远程脚本执行由 SSH Adapter（0003）承担，本适配器只负责本地。
 * 安全：运行时白名单 + 路径白名单 + 超时上限 + 审计（经 ActionService 统一切点）。
 */
@Injectable()
export class ScriptAdapter implements Adapter {
  readonly manifest = {
    id: 'script',
    name: 'Script',
    description: '本地多运行时脚本执行',
    version: '0.1.0',
  };

  constructor(@Inject(SCRIPT_CONFIG) private readonly cfg: ScriptAdapterConfig) {}

  register() {
    return [
      reg({
        action: {
          id: 'script.run',
          name: 'Run Script',
          description: '在平台宿主机本地执行一段脚本（多运行时）',
          visibility: 'internal',
          inputSchema: runInput,
          outputSchema: runOutput,
        },
        handler: async (input: RunInput, ctx: ActionContext) => this.run(input, ctx),
      }),
    ];
  }

  private async run(input: RunInput, ctx: ActionContext): Promise<ActionResult<RunOutput>> {
    if (!this.cfg.allowedRuntimes.includes(input.runtime)) {
      return fail('RUNTIME_NOT_ALLOWED', `运行时未在白名单: ${input.runtime}`);
    }
    if (input.timeoutMs > this.cfg.maxTimeoutMs) {
      return fail('INVALID_INPUT', `timeoutMs 超过上限 ${this.cfg.maxTimeoutMs}ms`);
    }

    const pathSrc = 'path' in input.source ? input.source.path : undefined;
    if (pathSrc && !withinAllowed(pathSrc, this.cfg.allowedScriptDirs)) {
      return fail('INVALID_SOURCE', '脚本路径不在允许目录内（见 SCRIPT_ALLOWED_DIRS）');
    }
    if (input.cwd && !withinAllowed(input.cwd, this.cfg.allowedScriptDirs)) {
      return fail('INVALID_SOURCE', 'cwd 不在允许目录内（见 SCRIPT_ALLOWED_DIRS）');
    }

    const result = await runScript(
      {
        runtime: input.runtime,
        inline: 'inline' in input.source ? input.source.inline : undefined,
        path: pathSrc,
        args: input.args ?? {},
        env: input.env ?? {},
        cwd: input.cwd,
        timeoutMs: Math.min(input.timeoutMs, this.cfg.maxTimeoutMs),
        parseJsonOutput: input.parseJsonOutput,
      },
      ctx.log,
    );

    // 审计：记录主体/运行时/退出码/耗时；不记录内联脚本正文（防泄露）
    ctx.log('info', 'script executed', {
      runtime: input.runtime,
      source: pathSrc ? { path: pathSrc } : { inline: true },
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      durationMs: result.durationMs,
    });

    return ok<RunOutput>({
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      data: result.data,
      timedOut: result.timedOut,
      durationMs: result.durationMs,
    });
  }
}
