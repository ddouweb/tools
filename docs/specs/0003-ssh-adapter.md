# 0003 — SSH Adapter（远程 Linux / Docker 管理）

- 状态：已实现（v0.1）
- 适配器 id：`ssh`
- 关联：CLAUDE.md「SSH Adapter」；[0001 Script Adapter](./0001-script-adapter.md)（本地脚本，本适配器负责远程）；[0002 Platform Core](./0002-platform-core.md)（授权/审计）

## 1. 目的

经 SSH 在远程 Linux 主机上执行命令，从而管理服务、Docker 容器等。与 0001（本地脚本）互补：0001 在平台宿主机执行，0003 在远程主机执行。Docker/服务管理不单列动作，而通过命令组合实现（如 `docker ps`、`systemctl restart nginx`）。

## 2. 范围

**范围内**
- 经 SSH 执行一条命令，返回结构化结果（exitCode/stdout/stderr/耗时）。
- 凭据由 `SshProfile`（DB 管理）按名称引用，**不随调用传明文**，保持审计干净。
- 超时、RBAC、审计。

**范围外（后续）**
- SFTP 文件传输、交互式 shell、连接池/复用。
- 凭据加密存储（见 §6 开放问题）。

## 3. 架构定位

- 实现为 Adapter（`implements Adapter`），注册于 `RuntimeModule`。
- 暴露 Action `ssh.run`，经 `ActionService` 走授权 + 审计切点（权限 `action:ssh.run` / `action:ssh.*`）。
- 凭据：`SshProfile` 模型 + `/admin/ssh/profiles` 管理（仅管理员）。

## 4. 数据模型

| 实体 | 关键字段 | 说明 |
| ---- | ---- | ---- |
| SshProfile | id, name(unique), host, port(默认 22), user, authType('password'\|'privateKey'), secret, createdAt | `secret` 为密码或 PEM 私钥；dev 明文，prod 应加密（开放问题） |

## 5. 暴露的 Action

### `ssh.run` —— 远程执行命令

**inputSchema（zod）**
```ts
z.object({
  profile: z.string().min(1),         // SshProfile.name
  command: z.string().min(1),
  timeoutMs: z.number().int().positive().max(600_000).default(60_000),
})
```

**outputSchema（zod）**
```ts
z.object({
  exitCode: z.number().int(),
  stdout: z.string(),
  stderr: z.string(),
  timedOut: z.boolean(),
  durationMs: z.number(),
})
```

**行为**：查 SshProfile → 用 ssh2 连接 → exec(command) → 收集输出 → 超时则关闭连接并 `timedOut=true`。profile 不存在 → `PROFILE_NOT_FOUND`；连接失败 → `SSH_CONNECT_FAILED`；超时 → `TIMEOUT`。

## 6. 安全考量

- **凭据**：存在 `SshProfile.secret`，调用只引用 profile 名，不传明文；审计只记 profile 名 + command，不记 secret。
- **加密**：dev 明文；prod 须加密（应用层加密/OS keyring）——开放问题。
- **RBAC**：`ssh.run` 默认 `internal`，须 `action:ssh.run`（或 `ssh.*`/`action:*`）授权。
- **超时**：`timeoutMs` 硬上限，超时关闭连接。

## 7. 对接契约

`POST /actions/ssh.run/invoke`（受 AuthGuard + RBAC），body 为 inputSchema；返回 `ActionResult<ssh.run output>`。

## 8. 开放问题

- 凭据加密方案（应用层对称加密 + 主密钥 vs OS keyring）。
- 私钥 passphrase 支持。
- 连接复用/池（高频调用场景）。
- 是否提供 `ssh.docker.*` 便捷动作（当前以命令组合实现）。
- 已知：Windows 上连接被拒后 ssh2 teardown 偶发 libuv 断言噪声（不影响服务存活，Linux 目标正常）；后续评估 `conn.destroy()` 与连接池。
