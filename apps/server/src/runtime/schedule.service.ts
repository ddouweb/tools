import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { CronJob } from 'cron';
import { PrismaService } from '../platform/prisma/prisma.service';
import { RbacService } from '../platform/rbac/rbac.service';
import { TaskService } from './task.service';

/**
 * ScheduleService —— cron 定时触发 Action（经 TaskService 异步执行）。
 * 启动时加载已启用调度；CRUD 时即时启停对应 CronJob。
 */
@Injectable()
export class ScheduleService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ScheduleService.name);
  private readonly jobs = new Map<string, CronJob>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TaskService,
    private readonly rbac: RbacService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const schedules = await this.prisma.schedule.findMany({ where: { enabled: true } });
    for (const s of schedules) this.start(s);
    this.logger.log(`loaded ${schedules.length} enabled schedule(s)`);
  }

  list() {
    return this.prisma.schedule.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(dto: {
    name: string;
    actionId: string;
    input?: unknown;
    cron: string;
    principalId: string;
    enabled?: boolean;
  }) {
    const s = await this.prisma.schedule.create({
      data: {
        name: dto.name,
        actionId: dto.actionId,
        input: safeStringify(dto.input ?? {}),
        cron: dto.cron,
        principalId: dto.principalId,
        enabled: dto.enabled ?? true,
      },
    });
    this.start(s);
    return s;
  }

  async update(
    id: string,
    dto: Partial<{
      name: string;
      actionId: string;
      input: unknown;
      cron: string;
      principalId: string;
      enabled: boolean;
    }>,
  ) {
    this.stop(id);
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dto)) data[k] = k === 'input' ? safeStringify(v) : v;
    const s = await this.prisma.schedule.update({ where: { id }, data: data as never });
    if (s.enabled) this.start(s);
    return s;
  }

  async remove(id: string) {
    this.stop(id);
    await this.prisma.schedule.delete({ where: { id } });
    return { id };
  }

  private start(s: { id: string; cron: string; enabled: boolean }): void {
    if (!s.enabled) return;
    try {
      const job = new CronJob(s.cron, () => {
        void this.fire(s.id);
      });
      this.jobs.set(s.id, job);
      job.start();
    } catch (e) {
      this.logger.warn(
        `invalid cron "${s.cron}" for schedule ${s.id}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  private stop(id: string): void {
    this.jobs.get(id)?.stop();
    this.jobs.delete(id);
  }

  private async fire(scheduleId: string): Promise<void> {
    const s = await this.prisma.schedule.findUnique({ where: { id: scheduleId } });
    if (!s || !s.enabled) {
      this.stop(scheduleId);
      return;
    }
    try {
      const principal = await this.rbac.getAuthUser(s.principalId);
      await this.tasks.submit(s.actionId, safeParse(s.input), principal);
      await this.prisma.schedule.update({ where: { id: scheduleId }, data: { lastRunAt: new Date() } });
    } catch (e) {
      this.logger.error(
        `schedule ${scheduleId} fire failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
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
