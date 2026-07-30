import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { ActionContext, ActionResult, Adapter } from '@tools/shared';
import { fail, ok, reg } from '@tools/shared';
import { PrismaService } from '../../platform/prisma/prisma.service';
import { CryptoService } from '../../platform/crypto/crypto.service';

const inputSchema = z.object({
  credential: z.string().optional(), // HttpCredential.name
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.unknown().optional(),
  timeoutMs: z.number().int().positive().max(600_000).default(30_000),
});
type Input = z.infer<typeof inputSchema>;

const outputSchema = z.object({
  status: z.number().int(),
  statusText: z.string(),
  headers: z.record(z.string(), z.string()),
  data: z.unknown(),
  durationMs: z.number(),
});
type Output = z.infer<typeof outputSchema>;

/**
 * HttpAdapter —— 通用第三方 API 调用（Jenkins 等）。凭据经 HttpCredential(DB)按名引用。
 * RBAC：须 action:http.request / action:http.* / action:*。
 */
@Injectable()
export class HttpAdapter implements Adapter {
  readonly manifest = {
    id: 'http',
    name: 'HTTP',
    description: '第三方 API 调用',
    version: '0.1.0',
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  register() {
    return [
      reg({
        action: {
          id: 'http.request',
          name: 'HTTP Request',
          description: '通用 HTTP 请求',
          visibility: 'internal',
          inputSchema,
          outputSchema,
        },
        handler: async (input: Input, _ctx: ActionContext) => this.run(input),
      }),
    ];
  }

  private async run(input: Input): Promise<ActionResult<Output>> {
    const headers: Record<string, string> = { ...(input.headers ?? {}) };

    if (input.credential) {
      const cred = await this.prisma.httpCredential.findUnique({ where: { name: input.credential } });
      if (!cred) return fail('CREDENTIAL_NOT_FOUND', `HTTP 凭据不存在: ${input.credential}`);
      applyAuth(headers, cred.authType, this.crypto.decrypt(cred.secret), cred.headerName ?? 'X-Token');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs);
    const startedAt = Date.now();
    try {
      const init: RequestInit = { method: input.method, headers, signal: controller.signal };
      if (input.body !== undefined && input.method !== 'GET') {
        init.body = typeof input.body === 'string' ? input.body : JSON.stringify(input.body);
        if (!('Content-Type' in headers) && typeof input.body !== 'string') {
          headers['Content-Type'] = 'application/json';
        }
      }
      const res = await fetch(input.url, init);
      const text = await res.text();
      let data: unknown = text;
      try {
        data = JSON.parse(text);
      } catch {
        // 非 JSON，保留原文
      }
      const respHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        respHeaders[k] = v;
      });
      return ok({
        status: res.status,
        statusText: res.statusText,
        headers: respHeaders,
        data,
        durationMs: Date.now() - startedAt,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') return fail('TIMEOUT', '请求超时');
      return fail('HTTP_REQUEST_FAILED', e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(timer);
    }
  }
}

function applyAuth(
  headers: Record<string, string>,
  authType: string,
  secret: string,
  headerName: string,
): void {
  if (authType === 'basic') {
    headers['Authorization'] = `Basic ${Buffer.from(secret).toString('base64')}`;
  } else if (authType === 'bearer') {
    headers['Authorization'] = `Bearer ${secret}`;
  } else if (authType === 'header') {
    headers[headerName || 'X-Token'] = secret;
  }
  // authType === 'none'：不加
}
