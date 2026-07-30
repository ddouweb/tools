# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

tools 是一个**统一的工具集门户与编排平台**。作为单一入口，把分散的各类工具聚合进来——本地脚本、远程 Linux/Docker、第三方 HTTP API（Jenkins 等只是其中之一，不为本项目特化），以及未来的工作/生活/游戏类工具。平台提供共享横切能力（登录、RBAC、审计、通知、任务调度），并支持工具间**关联操作**（事件触发动作）。双向集成：既调用外部工具，也对外暴露 API/API Token 供外部接入。

## 技术栈

- **后端**：Node.js + NestJS + TypeScript（CommonJS）；**前端**：Vue 3 + TS + Vite；**单仓**：pnpm workspaces。
- **DB/ORM**：Prisma v6（dev SQLite / prod Postgres）；**鉴权**：JWT access+refresh + `@node-rs/argon2`；**加密**：node:crypto AES-256-GCM；**SSH**：ssh2；**调度**：cron。
- 平台后端语言与被接入工具的语言相互独立——工具经 SSH/exec/HTTP 被调用，因此选 Node 做平台不妨碍用 Rust/Python/Go 写单个工具组件。

## 当前状态（handoff）

已实现（详见 `docs/README.md` 路线图）：
- **0001 Script Adapter**、**0003 SSH Adapter**、**0004 HTTP Adapter**：三类执行原语（本地脚本 / 远程命令 / HTTP）。
- **0002 Platform Core（全四阶段）**：登录/JWT、RBAC（Action 级+通配）、审计、通知（webhook+HMAC）、异步任务、cron 调度。
- **凭据加密**：SshProfile / HttpCredential / Webhook secret 经 `CryptoService`(AES-256-GCM) 加密落库，主密钥 `CREDENTIALS_KEY`。
- **0005 Action Bus 联动配置**：事件→动作的持久化规则。
- **前端门户**：登录 + 概览 + 动作调用 + 管理界面（用户/角色/Webhooks/SSH/HTTP凭据/联动/调度/任务/审计）。

**下一步（待用户决定）**：`docs/specs/0006-tool-as-resource.md` 已设计（草案），借鉴 K8s"一切皆资源" + OpenWrt 插件市场，引入**声明式 Tool 清单**——加工具从"写代码+重编译"降为"写清单→注册"，自动继承 RBAC/审计/联动。实现待评审。接入指南见 `docs/quick-start-tool.md`。

## 核心架构（必读）

**Action 是一切能力的统一单元**。所有工具动作都以 Action 形式注册，从而统一获得调用入口、RBAC、审计、通知、调度、联动。

请求管线（理解这条线就理解了大半系统）：
```
HTTP 请求 → 全局 AuthGuard(JWT access 或 API Token → req.user)
         → 控制器 → ActionService.run（授权+审计咽喉）
              ① 查 AdapterRegistry  ② RBAC（isAdmin 旁路，否则 action:<id>/通配）
              ③ zod 校验输入        ④ 执行 adapter handler
              ⑤ 写 AuditLog（回填 meta.auditLogId）+ emit action.<id>.succeeded/failed
         →（事件经 ActionBusService 匹配 LinkageRule → 异步触发目标 Action，单跳防递归）
```

两层工具模型：
- **执行原语（Primitive Adapters，代码）**：`script`/`ssh`/`http`——"怎么执行"，少数稳定。
- **声明式 Tool（资源，0006 待实现）**：清单声明 Action 并 `bind` 到一个原语 + 参数模板——"做什么"，零代码接入。

四个贯穿性概念：**平台核心**（auth/RBAC/审计/通知/任务，横切）、**Adapter**（工具集成）、**Action**（能力单元，RBAC/审计粒度）、**Action Bus**（声明式联动）。

## 代码结构

```
apps/server/src/
├── platform/            # 横切层（在 runtime 之上）
│   ├── prisma/          # PrismaService(@Global)
│   ├── crypto/          # CryptoService(AES-256-GCM, @Global)
│   ├── auth/            # AuthService/JWT、AuthGuard(APP_GUARD)、@Public、AuthUser
│   ├── rbac/            # RbacService（action 级+通配，getAuthUser）
│   ├── audit/           # AuditService
│   ├── notify/          # NotificationService（webhook）
│   └── admin/           # AdminService/Controller + AdminGuard（/admin/* 仅管理员）
├── runtime/             # 执行层
│   ├── adapter-registry.ts  # Action 中央索引
│   ├── action.service.ts    # ★ 授权+审计咽喉（改 Action 行为先看这里）
│   ├── action-bus.service.ts# 联动（事件→目标 Action）
│   ├── adapters/echo.adapter.ts        # 示例适配器（新代码式适配器的模板）
│   ├── script/、ssh/、http/            # 三类原语适配器
│   ├── task/、schedule/、linkage/       # 异步任务、cron 调度、联动规则
│   └── permission-sync.service.ts      # 启动把已注册 Action 同步为 Permission
├── app.controller.ts    # /health(公开) + /actions/:id/invoke
└── load-env.ts          # 最先加载 .env；并把 SQLite 路径锚定到 prisma/ 目录
apps/web/src/            # Vue 门户：api.ts(统一 fetch+token)、auth、router、views/
packages/shared/src/     # Adapter/Action/ActionBus 契约 + zod（前后端共用）
apps/server/prisma/      # schema.prisma + migrations + seed.ts
```

## 文档先行（硬性约定）+ 接入新工具

- 功能/工具**先写 spec**（`docs/specs/NNNN-*.md`）再实现；对外对接放 `docs/integrations/`。
- 接入新工具看 [`docs/quick-start-tool.md`](./docs/quick-start-tool.md)：**声明式清单（推荐，零代码）**绑定到 script/ssh/http 原语；需要自定义逻辑才写代码式 Adapter（以 `echo.adapter.ts` 为模板）。
- 进度与路线图见 [`docs/README.md`](./docs/README.md)。

## 构建 / 运行命令

```bash
pnpm install                          # 安装依赖（monorepo）
pnpm dev                              # 并行启动 server(:3000) + web(:5173)
pnpm --filter @tools/server dev       # 仅后端
pnpm --filter @tools/web dev          # 仅前端
pnpm --filter @tools/server typecheck # 类型检查
pnpm --filter @tools/server build     # 构建

# 数据库（首次或 schema 变更后）
pnpm --filter @tools/server exec prisma migrate dev
pnpm --filter @tools/server db:seed   # 初始化 admin/admin（仅 dev）
```

> dev 默认账号 `admin/admin`，生产请改密。配置由 `apps/server/.env`（复制自 `.env.example`）；SQLite 路径运行时锚定到 `prisma/`，不受启动 cwd 影响。
> pnpm 构建脚本策略：`@prisma/client`/`@prisma/engines`/`prisma`/`esbuild` 已在 `pnpm-workspace.yaml` allowBuilds 放行；`argon2`/`cpu-features`/`ssh2` 设 false（纯 JS 模式即可）。

## 关键约束

- **新工具优先声明式**（0006 清单 → 原语）；超出三原语才写代码式 Adapter，注册进 `RuntimeModule` 的 `ADAPTERS` 工厂。
- **改 Action 执行/授权/审计，改 `action.service.ts`**（唯一咽喉）；联动走 `action-bus.service.ts`，禁止硬编码 Adapter 互调。
- 横切能力（鉴权/审计/通知/加密）用 `platform/` 提供，工具内不自建。
- 机密（凭据/webhook secret）一律经 `CryptoService` 加密落库，API 返回不带 secret。
- 任何对外能力都要有 spec + 对接文档（文档先行）。
- TypeScript strict；契约放 `packages/shared`；server tsconfig 已关 declaration。
