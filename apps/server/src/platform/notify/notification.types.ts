export type NotificationLevel = 'info' | 'warn' | 'error';

export interface Notification {
  /** 事件标识，如 'action.error' / 'action.denied' / 'notification.test' */
  event: string;
  level: NotificationLevel;
  title: string;
  message: string;
  meta?: Record<string, unknown>;
  createdAt: string; // ISO 8601
}

/**
 * 扩展点：未来 email/IM 等通道实现此接口并注册到 NotificationService。
 * 当前仅 webhook（DB 驱动，在 NotificationService 内直接派发）。
 */
export interface NotificationChannel {
  id: string;
  send(n: Notification): Promise<void>;
}
