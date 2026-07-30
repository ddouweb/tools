# 0004 — HTTP Adapter（Jenkins 等第三方 API）

- 状态：已实现（v0.1）
- 适配器 id：`http`
- 关联：CLAUDE.md「HTTP Adapter」；[0003 SSH Adapter](./0003-ssh-adapter.md)；[0005 Action Bus](./0005-action-bus.md)（如「Jenkins 构建失败 → 触发脚本/通知」联动）

## 1. 目的

以通用 HTTP 请求调用第三方 API（Jenkins、各类 Web 服务）。Jenkins 触发/查询等由 `http.request` + 对应 Jenkins REST API 组合实现。这是平台"接入"外部系统的标准通道。

## 2. 范围

**范围内**：通用 `http.request`（method/url/headers/body/超时）；凭据经 `HttpCredential`(DB) 按名引用注入鉴权头；RBAC + 审计。
**范围外**：Jenkins 专用便捷动作（后续按需）；OAuth 流程；响应体大文件流式。

## 3. 架构定位

- Adapter（`implements Adapter`），注册于 `RuntimeModule`。
- Action `http.request`，经 `ActionService` 授权 + 审计（权限 `action:http.request` / `action:http.*`）。
- 凭据：`HttpCredential` + `/admin/http/credentials` 管理（仅管理员）。

## 4. 数据模型

| 实体 | 字段 | 说明 |
| ---- | ---- | ---- |
| HttpCredential | id, name(unique), authType('none'\|'basic'\|'bearer'\|'header'), secret, headerName?, createdAt | basic: secret=`user:pass`(自动 base64 为 Authorization: Basic)；bearer: Authorization: Bearer secret；header: 自定义 headerName: secret |

## 5. 暴露的 Action

### `http.request`

**inputSchema**
```ts
z.object({
  credential: z.string().optional(),       // HttpCredential.name；省略则不带鉴权
  method: z.enum(['GET','POST','PUT','PATCH','DELETE']).default('GET'),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.unknown().optional(),            // 对象/数组按 JSON 发送
  timeoutMs: z.number().int().positive().max(600_000).default(30_000),
})
```

**outputSchema**
```ts
z.object({
  status: z.number().int(),
  statusText: z.string(),
  headers: z.record(z.string(), z.string()),
  data: z.unknown(),      // 尝试 JSON 解析；否则原文
  durationMs: z.number(),
})
```

**行为**：查 credential（可选）→ 合并鉴权头与 headers → fetch（AbortController 超时）→ 解析响应。credential 不存在 → `CREDENTIAL_NOT_FOUND`；超时 → `TIMEOUT`；网络错误 → `HTTP_REQUEST_FAILED`。

## 6. 安全

- 凭据存 DB（dev 明文，prod 加密——与 SshProfile 同一开放问题）；调用只引用名，审计只记 url+method+credential 名，不记 secret。
- RBAC：默认 `internal`，须授权。
- body 与 headers 记审计摘要（脱敏）。

## 7. 对接契约

`POST /actions/http.request/invoke`（受 AuthGuard + RBAC）。

## 8. 开放问题

- 凭据加密存储（与 0003 共用方案）。
- 是否提供 `http.jenkins.*` 便捷动作封装常用 Jenkins API。
- 出站请求的代理/SSRF 防护（限制目标网段）。
