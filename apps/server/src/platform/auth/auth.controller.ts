import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { Public, type AuthUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() body: { username: string; password: string }) {
    return this.auth.login(body.username, body.password);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() body: { refreshToken: string }) {
    return this.auth.refresh(body.refreshToken);
  }

  @Get('me')
  me(@Req() req: Request) {
    return this.auth.me((req as unknown as { user: AuthUser }).user.id);
  }

  /** 申请 API Token（供外部系统接入；明文仅返回一次）。 */
  @Post('api-token')
  createApiToken(@Req() req: Request, @Body() body: { name: string }) {
    return this.auth.createApiToken((req as unknown as { user: AuthUser }).user.id, body.name);
  }
}
