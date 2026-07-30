import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';

/** 全局模块：CryptoService 全仓可用。 */
@Global()
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
