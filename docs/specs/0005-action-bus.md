# 0005 — Action Bus 联动配置

- 状态：已实现（v0.1）
- 关联：CLAUDE.md「Action Bus」；[0002 Platform Core](./0002-platform-core.md)（ActionBusService）

## 1. 目的

把"事件 → 动作"的跨工具联动做成**可配置**（DB 持久化 + 管理 API），落地"工具间关联操作"。例如：`action.script.run.failed → 触发 webhook 通知`、（未来）`jenkins.build-failed → 触发脚本`。

## 2. 架构

- `LinkageRule`(DB) + `ActionBusService`：启动加载已启用规则到内存；`emit` 时匹配事件并异步触发目标 Action。
- `ActionService` 在每次执行完成后自动发射事件 `action.<id>.succeeded` / `action.<id>.failed`（payload: `{ actionId, ok, errorCode?, correlationId }`）。

## 3. 数据模型

| 实体 | 字段 | 说明 |
| ---- | ---- | ---- |
| LinkageRule | id, name, sourceEventId, targetActionId, mode('passthrough'\|'static'), targetInput(JSON), enabled, createdAt | mode=passthrough：用事件 payload 作目标输入；mode=static：用 targetInput |

## 4. 联动语义与递归抑制

- **passthrough**：目标 Action 输入 = 事件 payload。
- **static**：目标 Action 输入 = 固定 `targetInput`（跨结构映射最常见的实用模式）。
- **递归抑制**：bus 触发目标 Action 时以 `SYSTEM_USER` 且 `suppressEmit=true` 执行 → 联动为**单跳**，避免"echo→echo"无限递归。多跳链式联动需显式配置各跳规则（后续可放宽）。

## 5. API

- `/admin/linkages` GET/POST/PATCH/DELETE（仅管理员）；变更后热重载内存规则。

## 6. 安全 / 开放问题

- 联动以 `system` 身份执行（旁路 RBAC，规则由管理员配置）。
- 事件源目前为平台自动发射的 `action.<id>.*`；适配器发射自定义事件（如 `jenkins.build-failed`）待各适配器按需接入。
- 后续：多跳链式联动、事件版本化、跨实例总线（Redis pub/sub）、联动执行审计聚合。
