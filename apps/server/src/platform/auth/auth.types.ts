import { SetMetadata } from '@nestjs/common';

/** 已认证主体（由 AuthGuard 解析后挂在 req.user）。 */
export interface AuthUser {
  id: string;
  username: string;
  isAdmin: boolean;
}

export const IS_PUBLIC = 'isPublic';

/** 标注路由为公开（跳过 AuthGuard），如 /health、/auth/login。 */
export const Public = () => SetMetadata(IS_PUBLIC, true);
