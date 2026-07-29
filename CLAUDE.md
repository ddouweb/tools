# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

tools 是一个**统一的工具集门户与编排平台**（unified tool portal & orchestration platform）。它作为单一入口，把分散的各类工具聚合进来：Windows 本地脚本执行、远程 Linux / Docker 管理、Jenkins 及其增强、以及未来的工作 / 生活 / 游戏类工具。平台提供**共享的横切能力**——统一登录、权限（RBAC）、消息通知、日志管理——并支持**工具之间的关联操作**（一个工具的事件可触发另一个工具的动作）。

平台是**双向集成**的：
- **接入（inbound）**：作为编排者，调用外部工具 / 脚本 / 系统。
- **被接入（outbound）**：对外暴露文档化的 API / Webhook / Action，让别的系统能快速接入本平台，并获得最大化支撑。

## 技术栈（已决策）

- **后端**：Node.js + NestJS + TypeScript
- **前端**：Vue 3 + TypeScript + Vite（SPA 门户）
- **包管理 / 单仓**：pnpm workspaces（monorepo）

选型理由：Node 的异步 I/O 模型契合"编排大量远程调用"的场景；NestJS 的模块 / DI / 装饰器结构与 Spring 心智模型一致，便于快速上手。注意：平台后端语言与被接入工具的语言相互独立——工具经 SSH / 本地 exec / HTTP 被调用，因此选 Node 做平台不妨碍某天用 Rust / Python / Go 写单个高性能工具组件。

## 核心架构模型

理解本系统必先理解以下四个概念，它们贯穿所有代码：

### 1. 平台核心（Platform Core）
常驻的横切服务，所有工具复用，禁止在工具内重复造轮子：
- **Auth**：统一登录、会话 / JWT
- **RBAC**：用户 / 角色 / 权限，控制谁能用哪些工具的哪些动作
- **Audit Log**：所有 Action 执行的可审计日志
- **Notification**：消息通知（多渠道，如 Webhook / 邮件 / IM）
- **Task / Job**：长任务、调度、异步执行（跨工具联动的基础）

### 2. 适配器（Adapter）
**每一个工具集成都实现为一个 Adapter**，向核心注册自己。新增工具 = 新增一个 Adapter，不动核心。基础适配器：
- **Script Adapter**：最大化脚本接入（见下）
- **SSH Adapter**：远程 Linux 命令执行、Docker / 服务管理
- **HTTP Adapter**：调用第三方 API（如 Jenkins）

### 3. 动作（Action）
Adapter 把自己能做的事注册成一个个 Action，带**类型化的输入 schema 和输出 schema**。RBAC 授权与审计日志都以 Action 为粒度。外部系统也可通过 API 触发 Action（实现"被接入"）。

### 4. 动作总线（Action Bus）
实现**工具间关联操作**的机制。Adapter 可声明"事件"，事件可触发其它 Adapter 的 Action（声明式联动，禁止硬编码）。例：Jenkins 构建失败 → 触发 Windows 脚本发送通知。

## 最大化脚本接入（Script Adapter 设计原则）

Script Adapter 是"本系统接入各种脚本"的核心，须最大化灵活：
- **多运行时**：PowerShell、cmd/batch、bash/sh、Python、Node 等，可配置执行器。
- **类型化参数 + 结构化输出**：输入按 schema 校验；输出除 stdout / stderr / exit code 外，支持解析 JSON 结构化结果。
- **执行位置**：平台宿主机本地（如 Windows 脚本）或经 SSH 远程。
- **安全与可控**：超时、资源限制、沙箱、统一记入审计日志。

## 最大化被接入（外部系统接入本平台的支撑）

让别的系统能快速接入，平台须提供：
- **文档化 API**：NestJS 控制器自动生成 OpenAPI，`docs/integrations/` 维护对接说明。
- **Webhook 接收**：外部系统可推送事件进来。
- **Action 调用 API**：外部系统经鉴权（API Token）触发已注册的 Action。
- **集成文档 / SDK**：每个对外能力都有对接文档，必要时提供生成的客户端。

## 文档驱动开发（硬性约定）

**后续所有开发一律"文档先行"。** 在写任何功能代码之前，先写设计文档 / 规格（spec）：

1. 功能 / 工具的设计 spec 放 `docs/specs/`，至少写清：目的、暴露的 Action、输入 / 输出 schema、对接契约、错误处理、安全考量。
2. 对外集成的对接说明放 `docs/integrations/`。
3. spec 评审通过后再实现；实现须与 spec 一致，spec 与代码同步演进。

本环境提供大量 spec 驱动技能（`api-spec-create` / `api-flow-spec-create` / `component-impl-spec-create` 等），实现前优先用它们产出 spec。运行技能：`/<skill-name>`。

## 预期目录结构

> 项目尚未脚手架。落地时据此组织：

```
tools/
├── apps/
│   ├── server/        # NestJS 后端（平台核心 + 适配器 + action bus）
│   └── web/           # Vue 3 前端门户
├── packages/
│   └── shared/        # 共享类型与契约（Adapter/Action 接口、DTO、schema）
├── docs/
│   ├── specs/         # 文档先行：功能/工具设计 spec
│   └── integrations/  # 外部系统接入本平台的对接文档
└── CLAUDE.md
```

## 构建 / 运行命令

> 项目尚未脚手架。用 NestJS CLI + Vite 落地后，预期命令如下（待补全）：

```bash
pnpm install              # 安装依赖（monorepo）
pnpm dev                  # 并行启动 server + web
pnpm --filter server dev  # 仅后端
pnpm --filter web dev     # 仅前端
pnpm --filter server test # 后端单测
pnpm lint                 # 全仓 lint
```

## 给后续开发的关键约束

- **新工具一律走 Adapter**：实现 Adapter 接口、注册 Action，不要在核心里直接写工具逻辑。
- **跨工具联动走 Action Bus**：声明式配置，禁止 Adapter 之间直接硬编码调用。
- **横切能力（鉴权 / 日志 / 通知）用核心提供的能力**，工具内不自建。
- **任何对外能力都要有 spec 和集成文档**（文档先行）。
- TypeScript strict 模式；契约（schema / DTO）放 `packages/shared`，前后端共用。
