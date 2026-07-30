import { createHmac } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import type { Notification } from './notification.types';

/**
 * NotificationService —— 向匹配事件的活动 webhook 派发通知。
 * fire-and-forget：单个 webhook 失败仅记日志，不影响主流程。
 * 有 secret 时附带 HMAC-SHA256 签名（X-Signature），便于接收方校验来源。
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async notify(n: Notification): Promise<void> {
    const hooks = await this.prisma.webhookConfig.findMany({ where: { active: true } });
    const matched = hooks.filter((h) => matchesEvent(h.events, n.event));
    if (matched.length === 0) return;
    await Promise.all(matched.map((h) => this.post(h, n)));
  }

  private async post(
    hook: { id: string; url: string; secret: string | null },
    n: Notification,
  ): Promise<void> {
    const body = JSON.stringify(n);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (hook.secret) {
      headers['X-Signature'] = createHmac('sha256', this.crypto.decrypt(hook.secret)).update(body).digest('hex');
    }
    try {
      const res = await fetch(hook.url, { method: 'POST', headers, body });
      if (!res.ok) this.logger.warn(`webhook ${hook.id} responded ${res.status}`);
    } catch (e) {
      this.logger.warn(`webhook ${hook.id} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

function matchesEvent(eventsCsv: string, event: string): boolean {
  if (!eventsCsv.trim()) return true; // 空 = 订阅全部
  return eventsCsv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(event);
}
