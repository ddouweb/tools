import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../platform/prisma/prisma.service';
import { ActionBusService } from './action-bus.service';

/** 联动规则 CRUD；变更后刷新 ActionBus 内存规则。 */
@Injectable()
export class LinkageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: ActionBusService,
  ) {}

  list() {
    return this.prisma.linkageRule.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(dto: {
    name: string;
    sourceEventId: string;
    targetActionId: string;
    mode?: string;
    targetInput?: unknown;
    enabled?: boolean;
  }) {
    if (!dto.name || !dto.sourceEventId || !dto.targetActionId) {
      throw new BadRequestException('name/sourceEventId/targetActionId 必填');
    }
    const r = await this.prisma.linkageRule.create({
      data: {
        name: dto.name,
        sourceEventId: dto.sourceEventId,
        targetActionId: dto.targetActionId,
        mode: dto.mode ?? 'passthrough',
        targetInput: dto.targetInput !== undefined ? JSON.stringify(dto.targetInput) : null,
        enabled: dto.enabled ?? true,
      },
    });
    await this.bus.refresh();
    return r;
  }

  async update(
    id: string,
    dto: Partial<{
      name: string;
      sourceEventId: string;
      targetActionId: string;
      mode: string;
      targetInput: unknown;
      enabled: boolean;
    }>,
  ) {
    const data: Record<string, unknown> = { ...dto };
    if (dto.targetInput !== undefined) data.targetInput = JSON.stringify(dto.targetInput);
    try {
      const r = await this.prisma.linkageRule.update({ where: { id }, data: data as never });
      await this.bus.refresh();
      return r;
    } catch {
      throw new NotFoundException('联动规则不存在');
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.linkageRule.delete({ where: { id } });
      await this.bus.refresh();
      return { id };
    } catch {
      throw new NotFoundException('联动规则不存在');
    }
  }
}
