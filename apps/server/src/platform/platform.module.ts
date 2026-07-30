import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { RbacService } from './rbac/rbac.service';
import { AuditService } from './audit/audit.service';

/**
 * PlatformModule —— 平台核心（鉴权/RBAC/审计）。
 * 注册全局 AuthGuard（APP_GUARD），并向 RuntimeModule 暴出 RbacService / AuditService。
 */
@Module({
  imports: [AuthModule],
  providers: [RbacService, AuditService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [RbacService, AuditService],
})
export class PlatformModule {}
