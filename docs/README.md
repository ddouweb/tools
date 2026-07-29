# docs — 文档先行

本项目遵循**文档驱动开发**：任何功能/工具在写代码之前，先在这里产出设计 spec；对外集成的对接说明放 `integrations/`。

## 目录

- `specs/` — 功能与适配器的设计 spec（实现前必写）
- `integrations/` — 外部系统接入本平台的对接文档（OpenAPI、Webhook、Action 调用 API、SDK）

## Spec 工作流

1. 在 `specs/` 新建编号文档（`NNNN-<slug>.md`，编号递增）。
2. 至少覆盖：**目的、范围、架构定位、暴露的 Action（含输入/输出 zod schema）、错误处理、安全考量、对接契约、开放问题**。
3. 评审通过后再实现；实现须与 spec 一致，spec 随代码演进。
4. 也可用环境里的 spec 驱动技能（`/<skill-name>`）辅助产出。

## Spec 路线图

| 编号 | 主题 | 状态 |
| ---- | ---- | ---- |
| [0001](./specs/0001-script-adapter.md) | Script Adapter（脚本接入） | 草案 |
| 0002 | Platform Core（登录 / RBAC / 审计 / 通知） | 待写 |
| 0003 | SSH Adapter（远程 Linux / Docker 管理） | 待写 |
| 0004 | HTTP Adapter（Jenkins 等第三方 API） | 待写 |
| 0005 | Action Bus 联动规则与配置 | 待写 |
