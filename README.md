# ai_tool — 统一工具集门户与编排平台

一个把分散的各类工具（Windows 本地脚本、远程 Linux/Docker 管理、Jenkins、以及未来的工作/生活/游戏类工具）聚合到一个统一入口的编排平台，提供共享的登录、权限（RBAC）、消息通知、日志管理，并支持工具之间的关联操作。

详细架构、技术决策与开发约定见 [`CLAUDE.md`](./CLAUDE.md)。

## 技术栈

- **后端**：Node.js + NestJS + TypeScript（`apps/server`）
- **前端**：Vue 3 + Vite + TypeScript（`apps/web`）
- **共享契约**：`packages/shared`（Adapter / Action / Action Bus 接口与 schema）
- **单仓**：pnpm workspaces

## 快速开始

```bash
pnpm install      # 安装依赖
pnpm dev          # 并行启动 server(默认 :3000) 与 web(默认 :5173)
pnpm build        # 构建全部
pnpm typecheck    # 类型检查
```

## 核心概念（详见 CLAUDE.md）

- **Platform Core**：鉴权 / RBAC / 审计日志 / 通知 / 任务调度（横切能力，所有工具复用）
- **Adapter**：每个工具集成实现为一个适配器，向核心注册
- **Action**：适配器暴露的能力，带类型化输入/输出 schema
- **Action Bus**：声明式的跨工具联动（事件 → 触发其它 Action）

## 开发约定

**文档先行**：任何功能在编码前先在 `docs/specs/` 写设计 spec；对外集成在 `docs/integrations/` 写对接文档。
