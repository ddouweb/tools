import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../platform/admin/admin.guard';
import { LinkageService } from './linkage.service';

/** 联动规则管理（仅管理员）。事件 -> Action 的声明式关联。 */
@Controller('admin/linkages')
@UseGuards(AdminGuard)
export class LinkageController {
  constructor(private readonly linkages: LinkageService) {}

  @Get()
  list() {
    return this.linkages.list();
  }

  @Post()
  create(
    @Body()
    body: {
      name: string;
      sourceEventId: string;
      targetActionId: string;
      mode?: string;
      targetInput?: unknown;
      enabled?: boolean;
    },
  ) {
    return this.linkages.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      sourceEventId: string;
      targetActionId: string;
      mode: string;
      targetInput: unknown;
      enabled: boolean;
    }>,
  ) {
    return this.linkages.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.linkages.remove(id);
  }
}
