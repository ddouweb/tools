# 0001 — Script Adapter（脚本接入）

- 状态：已实现（v0.1）
- 适配器 id：`script`
- 关联：CLAUDE.md「最大化脚本接入」；后续 [0003 SSH Adapter]（远程执行）

## 1. 目的

让本平台能**最大化地接入和执行各类脚本**——PowerShell、cmd/batch、bash/sh、Python、Node 等，把"跑一段脚本"变成平台上一个可被注册、可被授权、可被审计、可被跨工具联动的标准 Action。这是平台"接入（inbound）"能力的核心。

## 2. 范围

**范围内**
- 在平台宿主机（如 Windows 服务器）**本地**执行脚本，多运行时可选。
- 类型化参数（args/env）、结构化输出（stdout/stderr/exit code，可选 JSON 解析）。
- 超时、运行时白名单、路径白名单、审计。

**范围外（交给其它适配器）**
- **远程执行**：经 SSH 在 Linux 上跑命令/脚本 → 由 [0003 SSH Adapter] 承担。Script Adapter 只负责本地；远程脚本执行通过 SSH Adapter 完成，二者可经 Action Bus 组合。
- 长驻守护进程、交互式终端。

## 3. 架构定位

- 实现为一个 **Adapter**（`implements Adapter`），在 `RuntimeModule` 注册。
- 暴露若干 **Action**（zod schema 定义输入/输出），由 `ActionService` 统一执行、校验、记审计。
- 默认 `visibility: internal`（不直接对外部系统开放，须先经 RBAC；见 0002）。

## 4. 暴露的 Actions

### 4.1 `script.run` —— 执行一段脚本

执行一段内联脚本或本地脚本文件，返回结构化结果。

**inputSchema（zod）**

```ts
z.object({
  // 运行时；实际可用集合受平台「运行时白名单」限制（见 §6）
  runtime: z.enum(['powershell', 'cmd', 'bash', 'sh', 'python', 'node']),

  // 脚本来源：内联内容 或 受白名单限制的本地路径
  source: z.union([
    z.object({ inline: z.string().min(1) }),
    z.object({ path: z.string().min(1) }),
  ]),

  // 参数：按运行时约定注入（argv 或环境变量，键值均为字符串）
  args: z.record(z.string(), z.string()).optional(),
  // 额外环境变量
  env: z.record(z.string(), z.string()).optional(),
  // 工作目录（受路径白名单约束）
  cwd: z.string().optional(),
  // 超时（毫秒），硬上限受配置约束
  timeoutMs: z.number().int().positive().max(600_000).default(60_000),
  // 为 true 时：尝试把 stdout 末尾一行 JSON 解析为 data 字段
  parseJsonOutput: z.boolean().default(false),
})
```

**outputSchema（zod）**

```ts
z.object({
  exitCode: z.number().int(),
  stdout: z.string(),
  stderr: z.string(),
  data: z.unknown().optional(), // parseJsonOutput 为 true 且解析成功时存在
  timedOut: z.boolean(),
  durationMs: z.number(),
})
```

**行为**
1. 校验 `runtime` 在运行时白名单内，否则返回 `RUNTIME_NOT_ALLOWED`。
2. 若用 `source.path`，校验其落在路径白名单目录内，否则返回 `INVALID_SOURCE`。
3. 以平台进程身份 spawn 对应解释器：`inline` 写入临时文件或经 stdin/stdin-script 方式执行；`path` 直接执行。
4. 注入 `args`/`env`，启动计时；超时则杀进程并返回 `TIMEOUT`、`timedOut=true`。
5. `parseJsonOutput` 时解析 stdout 末行 JSON；失败不致命，仅置空并附 `PARSE_OUTPUT_FAILED` 提示（具体策略见 §7 开放问题）。
6. 全过程写入审计日志（脚本内容 + 关键输出，敏感字段可配置脱敏）。

### 4.2 `script.register`（阶段二，本文档先约定）

把一段常用脚本注册成**一等 Action**（带固定 id、参数 schema），使其可被发现、被联动、被授权——真正实现"脚本即工具"。实现细节待阶段二补充，本 spec 仅占位。

## 5. 错误处理

统一走 `ActionResult` 外壳（`ok:false` + `error.code`）：

| code | 触发条件 |
| ---- | ---- |
| `RUNTIME_NOT_ALLOWED` | 运行时不在白名单 |
| `INVALID_SOURCE` | 路径不在白名单 / 内联为空 |
| `RUNTIME_NOT_FOUND` | 解释器在宿主机不存在 |
| `TIMEOUT` | 超过 `timeoutMs` |
| `PARSE_OUTPUT_FAILED` | `parseJsonOutput` 解析失败（非致命，详见 §7） |
| `EXEC_ERROR` | spawn / IO 层面异常 |

## 6. 安全考量（核心）

脚本执行是高风险能力，默认从严：

- **运行时白名单**：平台配置显式列出允许的 runtime；未列入的一律拒绝。
- **超时硬上限**：`timeoutMs` 受全局上限约束，防止僵死。
- **路径白名单**：`source.path` 与 `cwd` 必须落在配置的可执行目录内，禁止任意路径。
- **身份与沙箱**：当前以平台进程身份执行——**这是已知风险**，文档须明确标注；后续引入 OS 级沙箱（Windows Job Object / 容器）收敛。
- **审计与脱敏**：每次执行记录主体、脚本、退出码、耗时；`env`/`args` 中的敏感键可配置脱敏后再落审计。
- **可见性**：默认 `internal`；对外暴露须经 RBAC（0002）授权。

## 7. 对接契约

- 调用方式：`POST /actions/script.run/invoke`，body 为 inputSchema 描述的对象。
- 返回：`ActionResult<script.run output>`。
- 该 Action 默认 `internal`；外部系统若需调用，待 0002 RBAC 落地后按角色授权。

## 8. 决议（实现 v0.1 已定）

- `parseJsonOutput` 解析失败 → **`ok:true`，`data` 留空并记 `PARSE_OUTPUT_FAILED` 警告日志**；脚本成败仍以 `exitCode` 为准，不把"输出格式不符"误判为执行失败。
- `args` 注入 → **统一以 `ARG_<KEY>` 环境变量注入**（内联与文件模式一致、跨运行时通用）；`env` 字段直接合并进子进程环境。
- 文件模式目前直接由解释器执行目标路径，未做临时文件落盘；如未来需要内联转临时文件，再补充清理与 Unix 权限位策略。
- 默认 `SCRIPT_ALLOWED_RUNTIMES=node`（默认最小开放），powershell/cmd/bash/sh/python 须显式配置开启。
