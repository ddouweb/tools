import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './platform/prisma/prisma.module';
import { PlatformModule } from './platform/platform.module';
import { RuntimeModule } from './runtime/runtime.module';

@Module({
  imports: [PrismaModule, PlatformModule, RuntimeModule],
  controllers: [AppController],
})
export class AppModule {}
