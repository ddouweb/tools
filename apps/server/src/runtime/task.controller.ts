import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../platform/auth/auth.types';
import { TaskService } from './task.service';

/** 异步任务入口：提交 + 查询（受全局 AuthGuard 保护）。 */
@Controller()
export class TaskController {
  constructor(private readonly tasks: TaskService) {}

  @Post('actions/:actionId/submit')
  submit(@Param('actionId') actionId: string, @Body() body: unknown, @Req() req: Request) {
    return this.tasks.submit(actionId, body, this.user(req));
  }

  @Get('tasks')
  list(@Req() req: Request) {
    return this.tasks.listTasks(this.user(req));
  }

  @Get('tasks/:id')
  get(@Param('id') id: string, @Req() req: Request) {
    return this.tasks.getTask(id, this.user(req));
  }

  private user(req: Request): AuthUser {
    return (req as unknown as { user: AuthUser }).user;
  }
}
