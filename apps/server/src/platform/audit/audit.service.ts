import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  principal: string;
  actionId: string;
  ok: boolean;
  errorCode?: string;
  durationMs: number;
  inputDigest?: string;
  correlationId?: string;
  denied?: boolean;
}

/** AuditService —— 写审计日志；输入仅存脱敏摘要。 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<string> {
    const log = await this.prisma.auditLog.create({ data: entry });
    return log.id;
  }

  /** 输入的短摘要（sha256 前 16 位），用于审计可追溯而不存明文敏感参数。 */
  digest(input: unknown): string | undefined {
    if (input == null) return undefined;
    try {
      return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 16);
    } catch {
      return undefined;
    }
  }
}
