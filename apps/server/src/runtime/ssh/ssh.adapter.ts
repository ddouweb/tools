import { Injectable } from '@nestjs/common';
import { Client } from 'ssh2';
import { z } from 'zod';
import type { ActionContext, ActionResult, Adapter } from '@tools/shared';
import { fail, ok, reg } from '@tools/shared';
import { PrismaService } from '../../platform/prisma/prisma.service';

const runInput = z.object({
  profile: z.string().min(1), // SshProfile.name
  command: z.string().min(1),
  timeoutMs: z.number().int().positive().max(600_000).default(60_000),
});
type RunInput = z.infer<typeof runInput>;

const runOutput = z.object({
  exitCode: z.number().int(),
  stdout: z.string(),
  stderr: z.string(),
  timedOut: z.boolean(),
  durationMs: z.number(),
});
type RunOutput = z.infer<typeof runOutput>;

/**
 * SshAdapter —— 经 SSH 在远程主机执行命令（服务/Docker 管理由命令组合实现）。
 * 凭据经 SshProfile（DB）按名称引用，不随调用传明文。
 * RBAC：须 action:ssh.run / action:ssh.* / action:*；审计只记 profile 名 + command。
 */
@Injectable()
export class SshAdapter implements Adapter {
  readonly manifest = {
    id: 'ssh',
    name: 'SSH',
    description: '远程 Linux 命令执行',
    version: '0.1.0',
  };

  constructor(private readonly prisma: PrismaService) {}

  register() {
    return [
      reg({
        action: {
          id: 'ssh.run',
          name: 'SSH Run',
          description: '经 SSH 在远程主机执行命令',
          visibility: 'internal',
          inputSchema: runInput,
          outputSchema: runOutput,
        },
        handler: async (input: RunInput, ctx: ActionContext) => this.run(input, ctx),
      }),
    ];
  }

  private async run(input: RunInput, _ctx: ActionContext): Promise<ActionResult<RunOutput>> {
    const profile = await this.prisma.sshProfile.findUnique({ where: { name: input.profile } });
    if (!profile) {
      return fail('PROFILE_NOT_FOUND', `SSH profile 不存在: ${input.profile}`);
    }
    return execOverSsh(profile, input.command, input.timeoutMs);
  }
}

interface Profile {
  host: string;
  port: number;
  user: string;
  authType: string;
  secret: string;
}

function execOverSsh(profile: Profile, command: string, timeoutMs: number): Promise<ActionResult<RunOutput>> {
  return new Promise((resolve) => {
    const conn = new Client();
    const startedAt = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    const finish = (r: ActionResult<RunOutput>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        conn.end();
      } catch {
        // ignore
      }
      resolve(r);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      finish(ok({ exitCode: -1, stdout, stderr, timedOut: true, durationMs: Date.now() - startedAt }));
    }, timeoutMs);

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          finish(fail('SSH_EXEC_ERROR', err.message));
          return;
        }
        stream.on('data', (d: Buffer) => {
          stdout += d.toString();
        });
        stream.stderr.on('data', (d: Buffer) => {
          stderr += d.toString();
        });
        stream.on('close', (code: number | null) => {
          finish(
            ok({
              exitCode: code ?? 0,
              stdout,
              stderr,
              timedOut,
              durationMs: Date.now() - startedAt,
            }),
          );
        });
      });
    });

    conn.on('error', (e: Error) => {
      finish(fail('SSH_CONNECT_FAILED', e.message));
    });

    conn.connect({
      host: profile.host,
      port: profile.port,
      username: profile.user,
      ...(profile.authType === 'privateKey' ? { privateKey: profile.secret } : { password: profile.secret }),
    });
  });
}
