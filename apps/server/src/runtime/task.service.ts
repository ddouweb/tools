import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';
import { ActionService } from './action.service';
import { RbacService } from '../platform/rbac/rbac.service';
import type { AuthUser } from '../platform/auth/auth.types';

/**
 * TaskService —— 异步执行 Action。
 * submit 立即返回 taskId，后台 runTask 经 ActionService 走完整授权/审计管线。
 * 任务的成败以 Action 的 ActionResult.ok 为准（失败也是"执行完成"，status=failed）。
 */
@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly actions: ActionService,
    private readonly rbac: RbacService,
  ) {}

  async submit(actionId: string, input: unknown, principal: AuthUser): Promise<{ taskId: string }> {
    const task = await this.prisma.task.create({
      data: { actionId, input: safeStringify(input), principalId: principal.id, status: 'pending' },
    });
    void this.runTask(task.id).catch((e) =>
      this.logger.error(`task ${task.id} crashed: ${e instanceof Error ? e.message : String(e)}`),
    );
    return { taskId: task.id };
  }

  private async runTask(taskId: string): Promise<void> {
    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: { status: 'running', startedAt: new Date() },
    });
    try {
      const principal = await this.rbac.getAuthUser(task.principalId);
      const result = await this.actions.run(task.actionId, safeParse(task.input), principal);
      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          status: result.ok ? 'succeeded' : 'failed',
          result: safeStringify(result),
          errorCode: result.error?.code ?? null,
          finishedAt: new Date(),
        },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`task ${taskId} error: ${message}`);
      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          errorCode: 'TASK_ERROR',
          result: safeStringify({ ok: false, error: { code: 'TASK_ERROR', message } }),
          finishedAt: new Date(),
        },
      });
    }
  }

  async listTasks(principal: AuthUser) {
    const where = principal.isAdmin ? {} : { principalId: principal.id };
    return this.prisma.task.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async getTask(id: string, principal: AuthUser) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('任务不存在');
    if (!principal.isAdmin && task.principalId !== principal.id) throw new ForbiddenException();
    return task;
  }
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v ?? null);
  } catch {
    return 'null';
  }
}
function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
