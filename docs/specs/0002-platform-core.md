# 0002 — Platform Core（平台核心：登录 / RBAC / 审计 / 通知 / 任务）

- 状态：已定（评审通过 2026-07-30；阶段一实现中）
- 关联：CLAUDE.md「平台核心」；[0001 Script Adapter](./0001-script-adapter.md)；`docs/integrations/`

## 1. 目的

提供所有适配器复用的**横切能力**：统一登录与鉴权、基于角色的权限（RBAC，Action 级）、审计日志、消息通知、异步任务/调度。目标是让任何工具在被调用前都经过统一的 **「身份 → 授权 → 执行 → 审计」** 管线，并让外部系统能凭 API Token 安全接入本平台（落实"最大化被接入"）。

## 2. 范围

**范围内**
- 用户 / 角色 / 权限的数据模型与校验。
- 登录（用户名密码）、JWT 颁发与校验、刷新与吊销。
- **Action 调用的授权与审计统一切点**（改造现有 `ActionService.run`）。
- API Token（供外部系统调用）。
- 通知通道**接口** + webhook 通道实现。
- 审计日志查询；异步任务执行（最小可用）。

**范围外（后续 spec）**
- 各通知渠道（邮件/IM）细节实现。
- 复杂任务编排（预期并入 Action Bus 联动配置，见 0005）。
- 前端管理 UI（由前端 spec 承接）。

## 3. 架构定位

- 代码位于 `apps/server/src/platform/`，位于 `RuntimeModule` 之上。
- **核心改造点**：`ActionService.run` 目前接收 `principal` 为字符串、审计为占位（`auditLogId` 留空）。本 spec 把它补全为授权 + 审计的**唯一咽喉**：调用前做 RBAC 校验，调用后写审计并回填 `meta.auditLogId`。
- `AuthGuard` 解析 JWT / API Token → 注入 `req.user`（principal）→ 由控制器传入 `ActionService`。

## 4. 数据模型（逻辑实体；ORM 用 Prisma，dev SQLite / prod Postgres）

| 实体 | 关键字段 | 说明 |
| ---- | ---- | ---- |
| User | id, username, email, passwordHash, status, createdAt | status: active/disabled |
| Role | id, name, description, isAdmin | isAdmin=true 为超级管理员，跳过权限匹配 |
| Permission | id, key | key 形如 `action:script.run` |
| UserRole | userId, roleId | 用户 ↔ 角色 多对多 |
| RolePermission | roleId, permissionId | 角色 ↔ 权限 多对多 |
| ApiToken | id, userId, name, tokenHash, lastUsedAt, expiresAt | 外部接入用；明文仅创建时返回一次 |
| RefreshToken | id, userId, tokenHash, expiresAt, revokedAt | 支持轮换与吊销 |
| AuditLog | id, principal, actionId, ok, errorCode?, durationMs, inputDigest, correlationId, createdAt | 追加不可改 |

## 5. 权限模型

- 权限 key = `action:<actionId>`，支持后缀 `*` 通配：`action:script.*`、`action:*`。
- 主体的**有效权限** = 其全部角色权限的并集（带短时缓存）。
- 超级管理员：`Role.isAdmin=true`（等价于持有 `action:*`），跳过匹配直接放行。
- 检查发生在 `ActionService.run` 内：命中放行；不命中 → 审计记录 `denied` 并返回 `fail('FORBIDDEN', ...)`。

## 6. 授权与审计切点（核心流程）

`ActionService.run(actionId, input, principal)`（在现有实现上增量改造）：

1. 解析主体有效权限（带缓存）。
2. 匹配 `action:<actionId>`（精确或通配）；不命中 → 写审计 `denied` + `return fail('FORBIDDEN')`。
3. 执行 handler（沿用既有：zod 校验 → handler → 计时）。
4. 写 `AuditLog`（principal / actionId / ok / errorCode / 耗时 / input 摘要 / correlationId），并把 `auditLogId` 回填到 `result.meta.auditLogId`。

> `visibility: public` 的 Action 允许外部经 API Token 调用；但 token 关联的用户**仍须持有该 action 的权限**。可见性只决定"能否被外部入口触达"，授权仍统一在切点判定。

## 7. API（规划）

- 认证：`POST /auth/login`、`POST /auth/refresh`、`POST /auth/logout`、`GET /auth/me`
- 动作（受 `AuthGuard` 保护）：`GET /actions`、`POST /actions/:actionId/invoke`（既有，补鉴权）
- 管理：`/admin/users`、`/admin/roles`、`/admin/permissions`、`/admin/api-tokens` 的 CRUD 与分配
- 审计：`GET /audit`（分页、按主体/actionId/时间过滤）

## 8. 安全考量

- 密码：argon2（首选）/ bcrypt 哈希存储。
- JWT：access 短时（约 15min）+ refresh 轮换 + 可吊销；secret 来自环境变量。
- 登录接口限流（防爆破）。
- API Token：仅创建时返回明文，库内只存哈希；记录 `lastUsedAt`。
- 审计日志：追加不可改；`inputDigest` 仅存摘要/脱敏后的输入，避免明文敏感参数。

## 9. 对接契约（被接入）

外部系统：以 `Authorization: Bearer <api-token>` 调用 `POST /actions/:actionId/invoke`，限 `visibility: public` 的 Action，且 token 关联用户须有权限。详细对接文档（鉴权流程、token 申请、错误码）随后落 `docs/integrations/`。

## 10. 决议（评审已定，2026-07-30）

- **数据层**：Prisma + SQLite(dev) / Postgres(prod)。
- **会话**：JWT access（短，~15min）+ refresh（轮换、可吊销）。
- **权限粒度**：Action 级 + 通配（`action:<id>` / `action:script.*` / `action:*`）。
- **其它已定**：密码 argon2；审计仅存 `inputDigest`（脱敏摘要）；超级管理员用 `Role.isAdmin`；`/health` 公开、其余路由受 `AuthGuard`；通知首期 webhook；异步任务延后到阶段四。

## 11. 分阶段实现

- **阶段一（安全 MVP，优先）**：User 模型 + 登录/JWT + `AuthGuard` + `ActionService` 的 RBAC/审计切点 + API Token。**完成后即解锁所有真实适配器的安全调用**（如 0001 的 `script.run` 才能被授权执行）。
- **阶段二**：RBAC 管理 API（用户/角色/权限 CRUD 与分配）+ 审计查询 API。
- **阶段三**：通知模块（webhook 通道，定义 `NotificationChannel` 接口）。
- **阶段四**：任务/调度（异步执行 Action、定时触发）。

> 本 spec 为实现前的设计文档（文档先行）。阶段一评审通过后再进入实现。
