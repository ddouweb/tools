import { Global, Module } from '@nestjs/common';
import { NotificationService } from './notification.service';

/** 全局模块：NotificationService 全仓可用（admin、runtime 等直接注入）。 */
@Global()
@Module({
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
