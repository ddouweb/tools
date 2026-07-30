import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';

const ALGO = 'aes-256-gcm';
const PREFIX = 'v1:';

/**
 * CryptoService —— 凭据等机密字段的对称加密（AES-256-GCM）。
 * 主密钥来自 CREDENTIALS_KEY（sha256 派生 32 字节）；未设置时用开发回退密钥并告警。
 * 密文形如 v1:<iv>:<tag>:<data>（均 base64）；decrypt 遇到非 v1: 前缀按明文原样返回（向后兼容）。
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly key: Buffer;

  constructor() {
    const raw = process.env.CREDENTIALS_KEY;
    if (raw && raw.trim()) {
      this.key = createHash('sha256').update(raw).digest();
    } else {
      this.logger.warn('CREDENTIALS_KEY 未设置，使用开发回退密钥——生产环境务必设置！');
      this.key = createHash('sha256').update('tools-dev-insecure-key').digest();
    }
  }

  encrypt(plain: string): string {
    if (plain == null) return plain;
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
  }

  decrypt(value: string): string {
    if (value == null || !value.startsWith(PREFIX)) return value; // 明文兼容
    const parts = value.split(':');
    const iv = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const data = Buffer.from(parts[3], 'base64');
    try {
      const decipher = createDecipheriv(ALGO, this.key, iv);
      decipher.setAuthTag(tag);
      const dec = Buffer.concat([decipher.update(data), decipher.final()]);
      return dec.toString('utf8');
    } catch {
      throw new Error('凭据解密失败（密钥不一致或数据损坏）');
    }
  }
}
