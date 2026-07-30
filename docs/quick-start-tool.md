# 快速接入一个新工具

把一个新工具/脚本接入 tools 平台，有两条路径：

| 路径 | 适用 | 是否写代码 |
| ---- | ---- | ---- |
| **声明式（推荐）** | 工具本质是"跑一段脚本 / 远程命令 / 调一个 HTTP" | 否，只写清单 |
| **代码式（高级）** | 需要 script/ssh/http 三原语之外的复杂自定义逻辑 | 是，写 Adapter |

> 90% 的场景用声明式即可。设计原理见 [0006 Tool as Resource](./specs/0006-tool-as-resource.md)。

---

## 路径一：声明式（写清单）

一个工具 = 一个清单（YAML/JSON），声明若干动作，每个动作**绑定**到一个执行原语（`script` / `ssh` / `http`）。

### 步骤

1. 写清单（见下例）。
2. 注册：`POST /admin/tools`（body 为清单），或把文件放进 `tools/` 目录（启动扫描）。
3. 注册后动作自动出现在目录、可被调用，并**自动继承** RBAC / 审计 / 通知 / 调度 / 联动。
4. 授权：把 `action:<工具名>.<动作>` 分配给角色（管理界面 → 角色）。
5. 调用：`POST /actions/<工具名>.<动作>/invoke`，或在前端"动作"页选择。

### 清单字段

- `metadata.name`：工具 id（动作 id 前缀，如 `nginx-manager.restart`）。
- `spec.actions[]`：每个动作：
  - `id` / `name` / `description`：标识。
  - `input`：暴露给调用者的输入 schema（JSON-Schema 子集）。
  - `bind.runtime`：`script` | `ssh` | `http`（复用哪个原语）。
  - `bind.call`：原语动作 id（`script.run` / `ssh.run` / `http.request`）。
  - `bind.params`：传给原语的参数。支持 `{{ input.<path> }}` 模板（由调用者输入渲染）；常量直接写（凭据/profile 等敏感固定项在这里绑定，调用者无需也无力改动）。

### 示例 A：本地脚本工具（PowerShell 清理磁盘）

```yaml
apiVersion: tools/v1
kind: Tool
metadata: { name: disk-cleanup, description: Windows 磁盘清理 }
spec:
  actions:
    - id: run
      input:
        type: object
        properties: { keepDays: { type: number } }
      bind:
        runtime: script
        call: script.run
        params:
          runtime: powershell
          source:
            inline: "Get-ChildItem C:\\temp | Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-{{input.keepDays}})} | Remove-Item"
```

### 示例 B：远程命令工具（SSH 重启 Nginx）

```yaml
apiVersion: tools/v1
kind: Tool
metadata: { name: nginx-manager }
spec:
  actions:
    - id: restart
      input:
        type: object
        properties: { profile: { type: string } }
        required: [profile]
      bind:
        runtime: ssh
        call: ssh.run
        params:
          profile: "{{ input.profile }}"
          command: "systemctl restart nginx"
```

> `profile` 指向管理员预先建好的 SSH profile（凭据加密存储），调用者只填 profile 名，不接触密钥。

### 示例 C：HTTP 工具（任意第三方 API）

```yaml
apiVersion: tools/v1
kind: Tool
metadata: { name: weather }
spec:
  actions:
    - id: now
      input: { type: object, properties: { city: { type: string } }, required: [city] }
      bind:
        runtime: http
        call: http.request
        params:
          method: GET
          url: "https://api.example.com/weather?q={{ input.city }}"
```

> 需要鉴权时：先在管理界面建 HTTP 凭据，再在 `params.credential` 绑定凭据名。

### 管理动作

- 启用/禁用整个工具：`PATCH /admin/tools/:name { enabled: false }`（不删数据）。
- 卸载：`DELETE /admin/tools/:name`。
- 查看：`GET /tools`（目录）、`GET /tools/:name/actions/:actionId`（schema，类 `kubectl explain`）。

---

## 路径二：代码式（写 Adapter）

当工具逻辑超出三原语（如自定义协议、复杂本地状态机）时，写一个 `implements Adapter` 的类并注册。以 `apps/server/src/runtime/adapters/echo.adapter.ts` 为模板：

1. 实现 `Adapter`：`manifest` + `register()` 返回 `Action`（含 zod input/output schema + handler）。
2. 加入 `RuntimeModule` 的 `ADAPTERS` 工厂列表。
3. 其动作同样自动获得 RBAC / 审计 / 联动等。

> 代码式是"高级逃生舱"，优先尝试用声明式 + 三原语组合表达。

---

## 接入后你免费得到的能力

无论哪条路径，动作注册后即享：

- 统一调用入口与结果外壳（ok/data/error/meta）；
- RBAC（Action 级 + 通配）；
- 审计日志（自动记录主体/结果/耗时）；
- 通知（HANDLER_ERROR 自动触发 webhook）；
- 异步任务 / cron 调度；
- 联动（事件 → 其它动作，见 [0005](./specs/0005-action-bus.md)）；
- 外部系统可凭 API Token 调用 `visibility: public` 的动作。

即：**接入一次，平台能力全开**。
