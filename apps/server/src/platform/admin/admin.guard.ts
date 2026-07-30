import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';

/** 仅管理员（principal.isAdmin）可访问。依赖全局 AuthGuard 已写入 req.user。 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const user = (req as { user?: AuthUser }).user;
    if (!user?.isAdmin) throw new ForbiddenException('需要管理员权限');
    return true;
  }
}
