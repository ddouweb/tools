# integrations — 外部系统接入本平台

本目录汇集"别的系统如何接入本平台"的对接文档，支撑 CLAUDE.md 中「最大化被接入」的目标。

## 接入方式（规划）

- **REST API**：由 NestJS 控制器自动生成 OpenAPI（实现后挂 `/docs`）。`POST /actions/:actionId/invoke` 可触发 `visibility: public` 的 Action。
- **Webhook 接收**：外部系统推送事件到平台（待实现）。
- **API Token 鉴权**：外部调用方凭 token 调用（待 0002 平台核心落地）。
- **客户端 SDK**：必要时基于 OpenAPI 生成。

> 本目录随平台核心（0002）与各对外 Action 的实现逐步填充；每个对外能力须有对应对接文档。
