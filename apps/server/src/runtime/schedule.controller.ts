import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../platform/admin/admin.guard';
import { ScheduleService } from './schedule.service';

/** 调度管理（仅管理员）。cron 触发时以 schedule.principalId 对应主体执行。 */
@Controller('admin/schedules')
@UseGuards(AdminGuard)
export class ScheduleController {
  constructor(private readonly schedules: ScheduleService) {}

  @Get()
  list() {
    return this.schedules.list();
  }

  @Post()
  create(
    @Body()
    body: {
      name: string;
      actionId: string;
      input?: unknown;
      cron: string;
      principalId: string;
      enabled?: boolean;
    },
  ) {
    return this.schedules.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      actionId: string;
      input: unknown;
      cron: string;
      principalId: string;
      enabled: boolean;
    }>,
  ) {
    return this.schedules.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.schedules.remove(id);
  }
}
