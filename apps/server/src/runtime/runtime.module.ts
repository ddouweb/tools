import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { AdapterRegistry } from './adapter-registry';
import { ActionService } from './action.service';
import { ActionBusService } from './action-bus.service';
import { AdapterBootstrap } from './adapter-bootstrap';
import { EchoAdapter } from './adapters/echo.adapter';
import { ScriptAdapter } from './script/script.adapter';
import { SCRIPT_CONFIG, scriptConfigFromEnv } from './script/script.config';
import { PermissionSyncService } from './permission-sync.service';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';

/**
 * RuntimeModule —— 适配器运行时内核 + 任务/调度。
 */
@Module({
  imports: [PlatformModule],
  controllers: [TaskController, ScheduleController],
  providers: [
    AdapterRegistry,
    ActionService,
    ActionBusService,
    EchoAdapter,
    ScriptAdapter,
    { provide: SCRIPT_CONFIG, useFactory: () => scriptConfigFromEnv() },
    {
      provide: 'ADAPTERS',
      useFactory: (echo: EchoAdapter, script: ScriptAdapter) => [echo, script],
      inject: [EchoAdapter, ScriptAdapter],
    },
    AdapterBootstrap,
    PermissionSyncService,
    TaskService,
    ScheduleService,
  ],
  exports: [AdapterRegistry, ActionService, ActionBusService],
})
export class RuntimeModule {}
