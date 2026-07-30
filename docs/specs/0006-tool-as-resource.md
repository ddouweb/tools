# 0006 — Tool as Resource（声明式工具 / 插件模型）

- 状态：草案（设计，待评审后实现）
- 关联：CLAUDE.md「Adapter / Action / Action Bus」；[0001 Script](./0001-script-adapter.md) / [0003 SSH](./0003-ssh-adapter.md) / [0004 HTTP](./0004-http-adapter.md)（执行原语）；[0002](./0002-platform-core.md)（RBAC/审计）；[0005](./0005-action-bus.md)（联动）

## 1. 动机

现状：每个工具 = 手写 Adapter（TS）+ 注册进 `RuntimeModule` + 重新编译。扩展是**编译期**的，门槛高、节奏慢。

借鉴：
- **K8s「一切皆资源」**：声明式 `spec` + 控制器 reconcile + CRD 自描述 + 统一 API（list/get/apply/watch）。加能力 = 定义资源，工具(kubectl)通用。
- **OpenWrt 插件市场**：自描述包 + 安装/启用/禁用 + 统一注册进 LuCI。加能力 = 装一个包。

目标：把"加一个工具"从"写代码 + 重编译"降为"写一个清单 → 注册"，且**自动继承** RBAC / 审计 / 通知 / 调度 / 联动。Jenkins 只是用到的众多第三方之一，不为本项目特化。

## 2. 核心思想：两层模型

1. **执行原语（Primitive Adapters，保留为代码）**：`script` / `ssh` / `http` —— 回答"怎么执行"。少数、稳定，随平台演进。
2. **工具（Tool，声明式资源）**：一个清单，回答"做什么"。声明若干 Action，每个 **`bind`** 到一个原语的调用 + 参数模板。

> 类比：原语 ≈ K8s 底层能力/控制器；Tool 清单 ≈ CRD 实例；`ToolAdapter` ≈ 把清单 reconcile 成可调用 Action 的控制器；目录 ≈ `kubectl api-resources`/`explain`；安装/启用 ≈ OpenWrt opkg / 插件开关。

## 3. Tool 清单（manifest）

```yaml
apiVersion: tools/v1
kind: Tool
metadata:
  name: nginx-manager
  version: 0.1.0
  description: 管理 Nginx 服务
  category: ops
spec:
  actions:
    - id: restart
      name: 重启 Nginx
      description: systemctl restart nginx
      input:                       # 暴露给调用者的 schema（JSON-Schema 子集 ↔ zod）
        type: object
        properties:
          profile: { type: string, description: SSH profile 名 }
        required: [profile]
      bind:
        runtime: ssh               # 复用原语：script | ssh | http
        call: ssh.run              # 调用的原语 action id
        params:                    # 传给原语的参数，支持 {{ input.x }} 模板；常量直写
          profile: "{{ input.profile }}"
          command: "systemctl restart nginx"
    - id: tail-log
      bind:
        runtime: script
        call: script.run
        params:
          runtime: powershell
          source: { inline: "Get-Content C:\\nginx\\logs\\access.log -Tail 50" }
```

- `input`：调用者可见的输入 schema。
- `bind.params`：传给原语的参数；`{{ input.<path> }}` 占位由调用者输入渲染，常量直接写（凭据/profile 等敏感固定项由工具绑定，调用者不接触）。
- 一个 Tool 可声明多个 action。

## 4. 资源化收益（统一性）

注册后，Tool 的每个 action 即成为**一等 Action**（id = `<tool>.<action>`），自动获得：

- 统一调用 `POST /actions/:id/invoke`；
- **RBAC**：`action:<tool>.<action>`，由权限自动同步机制（0002）立即可分配；
- **审计 / 通知 / 任务 / 调度 / 联动**：全部复用现有管线；
- **目录自描述**：`GET /tools`（类 `api-resources`）、`GET /tools/:id/actions/:actionId`（类 `explain`）。

即：**加工具 = 加清单，零代码、零重编译，且与平台一切能力对齐**。

## 5. 生命周期 / 市场

- Tool 是资源：`/admin/tools` register / list / get / enable / disable / uninstall（仅管理员）。
- `/tools` 公开目录（已登录可查），用于发现与前端"插件市场"页。
- 启用/禁用 = 激活/停用其 action，不删数据（OpenWrt 风格）。
- 后续：从 git/registry 拉取工具包（opkg feed 风格）、版本升级、依赖声明。

## 6. 架构落地

- **`ToolAdapter`（一次性代码）**：加载已启用 Tool 清单 → 为每个 action 注册一个 Action，其 handler = 用模板渲染 `bind.params` → 调 `ActionService.run(bind.call, params, principal, { suppressEmit: true })` 返回结果。
- **存储**：DB（`Tool` + `ToolAction`，或单表存 manifest JSON）；MVP 用 DB + API 注册，同时支持 `tools/*.yaml` 文件目录扫描。
- **模板渲染**：MVP 仅 `{{ input.<path> }}` 占位；不上完整表达式引擎。
- **安全**：`bind.call` 限定为已注册原语白名单；params 经原语自身 zod schema 二次校验；RBAC 仍按 `<tool>.<action>`；工具卸载/禁用即时从注册表移除。

## 7. 范围 / 开放问题

- **MVP**：声明式工具绑定**单一**原语（script/ssh/http）。
- **后续**：`composite`（多步/条件/并行，可复用 0005 联动思路）、从 registry 分发、UI 插件市场页。
- **明确不做**：运行时动态加载自定义代码插件（安全与复杂度高，需要自定义逻辑仍走"代码式 Adapter"，见接入指南）。
- input schema：JSON-Schema 子集 ↔ zod 双向映射。
