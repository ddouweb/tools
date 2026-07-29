import { Module } from '@nestjs/common';
import { AdapterRegistry } from './adapter-registry';
import { ActionService } from './action.service';
import { ActionBusService } from './action-bus.service';
import { AdapterBootstrap } from './adapter-bootstrap';
import { EchoAdapter } from './adapters/echo.adapter';

/**
 * RuntimeModule — 适配器运行时内核。
 * 暴出 AdapterRegistry / ActionService / ActionBusService 供控制器与未来平台核心使用。
 */
@Module({
  providers: [
    AdapterRegistry,
    ActionService,
    ActionBusService,
    EchoAdapter,
    {
      provide: 'ADAPTERS',
      useFactory: (echo: EchoAdapter) => [echo],
      inject: [EchoAdapter],
    },
    AdapterBootstrap,
  ],
  exports: [AdapterRegistry, ActionService, ActionBusService],
})
export class RuntimeModule {}
