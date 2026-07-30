import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** 全局模块，使 PrismaService 全仓可用，无需在各模块重复导入。 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
