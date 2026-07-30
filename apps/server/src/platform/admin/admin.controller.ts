import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

/**
 * 管理后台（阶段二）：用户/角色/权限 CRUD + 分配 + 审计查询。
 * 全部仅管理员（@UseGuards(AdminGuard)，依赖全局 AuthGuard 已鉴权）。
 */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // ---- users ----
  @Get('users')
  listUsers() {
    return this.admin.listUsers();
  }
  @Post('users')
  createUser(@Body() body: { username: string; password: string; email?: string; roleIds?: string[] }) {
    return this.admin.createUser(body);
  }
  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() body: { email?: string; status?: string; password?: string }) {
    return this.admin.updateUser(id, body);
  }
  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.admin.deleteUser(id);
  }
  @Put('users/:id/roles')
  setUserRoles(@Param('id') id: string, @Body() body: { roleIds: string[] }) {
    return this.admin.setUserRoles(id, body.roleIds ?? []);
  }

  // ---- roles ----
  @Get('roles')
  listRoles() {
    return this.admin.listRoles();
  }
  @Post('roles')
  createRole(@Body() body: { name: string; description?: string; isAdmin?: boolean }) {
    return this.admin.createRole(body);
  }
  @Patch('roles/:id')
  updateRole(@Param('id') id: string, @Body() body: { name?: string; description?: string; isAdmin?: boolean }) {
    return this.admin.updateRole(id, body);
  }
  @Delete('roles/:id')
  deleteRole(@Param('id') id: string) {
    return this.admin.deleteRole(id);
  }
  @Put('roles/:id/permissions')
  setRolePermissions(@Param('id') id: string, @Body() body: { permissionIds: string[] }) {
    return this.admin.setRolePermissions(id, body.permissionIds ?? []);
  }

  // ---- permissions ----
  @Get('permissions')
  listPermissions() {
    return this.admin.listPermissions();
  }
  @Post('permissions')
  createPermission(@Body() body: { key: string }) {
    return this.admin.createPermission(body.key);
  }

  // ---- notifications ----
  @Get('notifications/webhooks')
  listWebhooks() {
    return this.admin.listWebhooks();
  }
  @Post('notifications/webhooks')
  createWebhook(
    @Body() body: { name: string; url: string; secret?: string; events?: string; active?: boolean },
  ) {
    return this.admin.createWebhook(body);
  }
  @Patch('notifications/webhooks/:id')
  updateWebhook(
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; url: string; secret: string; events: string; active: boolean }>,
  ) {
    return this.admin.updateWebhook(id, body);
  }
  @Delete('notifications/webhooks/:id')
  deleteWebhook(@Param('id') id: string) {
    return this.admin.deleteWebhook(id);
  }
  @Post('notifications/test')
  testWebhook() {
    return this.admin.testWebhook();
  }

  // ---- ssh profiles ----
  @Get('ssh/profiles')
  listSshProfiles() {
    return this.admin.listSshProfiles();
  }
  @Post('ssh/profiles')
  createSshProfile(
    @Body() body: { name: string; host: string; port?: number; user: string; authType?: string; secret: string },
  ) {
    return this.admin.createSshProfile(body);
  }
  @Patch('ssh/profiles/:id')
  updateSshProfile(
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; host: string; port: number; user: string; authType: string; secret: string }>,
  ) {
    return this.admin.updateSshProfile(id, body);
  }
  @Delete('ssh/profiles/:id')
  deleteSshProfile(@Param('id') id: string) {
    return this.admin.deleteSshProfile(id);
  }

  // ---- audit ----
  @Get('audit')
  queryAudit(@Query() query: Record<string, string>) {
    return this.admin.queryAudit(query);
  }
}
