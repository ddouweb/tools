import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { Adapter } from '@ai-tool/shared';
import { ok, reg } from '@ai-tool/shared';

/**
 * EchoAdapter — 最小示例适配器，演示"注册即生效"的完整链路。
 * 同时作为后续真实适配器（SSH / Script / Jenkins）作者的参考模板。
 */
@Injectable()
export class EchoAdapter implements Adapter {
  readonly manifest = {
    id: 'echo',
    name: 'Echo',
    description: '示例适配器：原样回显输入',
    version: '0.1.0',
  };

  register() {
    return [
      reg({
        action: {
          id: 'echo.echo',
          name: 'Echo',
          description: '原样返回输入的 message',
          visibility: 'public',
          inputSchema: z.object({ message: z.string() }),
          outputSchema: z.object({ message: z.string(), receivedAt: z.string() }),
        },
        handler: async (input) =>
          ok({ message: input.message, receivedAt: new Date().toISOString() }),
      }),
    ];
  }
}
