<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api';

type Tab = 'users' | 'roles' | 'webhooks' | 'ssh' | 'http' | 'linkages' | 'schedules' | 'tasks' | 'audit';
const tab = ref<Tab>('users');
const tabList: { id: Tab; label: string }[] = [
  { id: 'users', label: '用户' }, { id: 'roles', label: '角色' }, { id: 'webhooks', label: 'Webhooks' },
  { id: 'ssh', label: 'SSH' }, { id: 'http', label: 'HTTP凭据' }, { id: 'linkages', label: '联动' },
  { id: 'schedules', label: '调度' }, { id: 'tasks', label: '任务' }, { id: 'audit', label: '审计' },
];

const users = ref<any[]>([]);
const roles = ref<any[]>([]);
const webhooks = ref<any[]>([]);
const ssh = ref<any[]>([]);
const http = ref<any[]>([]);
const linkages = ref<any[]>([]);
const schedules = ref<any[]>([]);
const tasks = ref<any[]>([]);
const audit = ref<{ total: number; items: any[] } | null>(null);
const meId = ref('');

const err = ref('');
const formErr = ref('');

// create forms
const whName = ref(''); const whUrl = ref(''); const whEvents = ref('');
const sshName = ref(''); const sshHost = ref(''); const sshPort = ref(22); const sshUser = ref(''); const sshAuth = ref('password'); const sshSecret = ref('');
const httpName = ref(''); const httpAuth = ref('bearer'); const httpSecret = ref(''); const httpHeader = ref('');
const lkName = ref(''); const lkSrc = ref('action.echo.echo.succeeded'); const lkTgt = ref('echo.echo'); const lkMode = ref('static'); const lkInput = ref('{\n  "message": "linked"\n}');
const scName = ref(''); const scAction = ref('echo.echo'); const scCron = ref('*/5 * * * *'); const scInput = ref('{\n  "message": "scheduled"\n}');

function tryJson(s: string): unknown | undefined {
  try { return JSON.parse(s); } catch { return undefined; }
}

async function load() {
  err.value = '';
  try {
    if (tab.value === 'users') users.value = await api.users();
    if (tab.value === 'roles') roles.value = await api.roles();
    if (tab.value === 'webhooks') webhooks.value = await api.webhooks();
    if (tab.value === 'ssh') ssh.value = await api.sshProfiles();
    if (tab.value === 'http') http.value = await api.httpCredentials();
    if (tab.value === 'linkages') linkages.value = await api.linkages();
    if (tab.value === 'schedules') schedules.value = await api.schedules();
    if (tab.value === 'tasks') tasks.value = await api.tasks();
    if (tab.value === 'audit') audit.value = await api.audit('pageSize=50');
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
}

async function selectTab(t: Tab) {
  tab.value = t;
  await load();
}

async function createWh() {
  await api.createWebhook({ name: whName.value || 'webhook', url: whUrl.value, events: whEvents.value });
  whName.value = ''; whUrl.value = ''; whEvents.value = '';
  await load();
}
async function createSsh() {
  formErr.value = '';
  await api.createSshProfile({ name: sshName.value, host: sshHost.value, port: Number(sshPort.value) || 22, user: sshUser.value, authType: sshAuth.value, secret: sshSecret.value });
  sshName.value = ''; sshHost.value = ''; sshUser.value = ''; sshSecret.value = '';
  await load();
}
async function createHttp() {
  await api.createHttpCredential({ name: httpName.value, authType: httpAuth.value, secret: httpSecret.value, headerName: httpHeader.value || undefined });
  httpName.value = ''; httpSecret.value = ''; httpHeader.value = '';
  await load();
}
async function createLk() {
  formErr.value = '';
  const input = tryJson(lkInput.value);
  if (lkInput.value.trim() && input === undefined) { formErr.value = 'targetInput 不是合法 JSON'; return; }
  await api.createLinkage({ name: lkName.value, sourceEventId: lkSrc.value, targetActionId: lkTgt.value, mode: lkMode.value, targetInput: input });
  lkName.value = '';
  await load();
}
async function createSc() {
  formErr.value = '';
  const input = tryJson(scInput.value);
  if (scInput.value.trim() && input === undefined) { formErr.value = 'input 不是合法 JSON'; return; }
  await api.createSchedule({ name: scName.value, actionId: scAction.value, cron: scCron.value, principalId: meId.value, input: input ?? {} });
  scName.value = '';
  await load();
}
async function testWh() {
  await api.testWebhook();
  alert('已向所有启用的 webhook 发送测试通知');
}

onMounted(async () => {
  try { meId.value = (await api.me()).id; } catch { /* ignore */ }
  await load();
});
</script>

<template>
  <section>
    <h2>管理</h2>
    <nav class="tabs">
      <button v-for="t in tabList" :key="t.id" :class="{ on: tab === t.id }" @click="selectTab(t.id)">{{ t.label }}</button>
    </nav>
    <p class="err" v-if="err">{{ err }}</p>
    <p class="err" v-if="formErr">{{ formErr }}</p>

    <!-- users -->
    <table v-if="tab === 'users'">
      <tr><th>用户名</th><th>状态</th><th>角色</th></tr>
      <tr v-for="u in users" :key="u.id"><td>{{ u.username }}</td><td>{{ u.status }}</td><td>{{ u.roles.map((r:any)=>r.name).join(', ') }}</td></tr>
    </table>

    <!-- roles -->
    <table v-if="tab === 'roles'">
      <tr><th>角色</th><th>isAdmin</th><th>权限</th><th>用户数</th></tr>
      <tr v-for="r in roles" :key="r.id"><td>{{ r.name }}</td><td>{{ r.isAdmin }}</td><td>{{ r.permissions.map((p:any)=>p.permission.key).join(', ') }}</td><td>{{ r._count?.users }}</td></tr>
    </table>

    <!-- webhooks -->
    <div v-if="tab === 'webhooks'">
      <p class="row"><input v-model="whName" placeholder="名称" /><input v-model="whUrl" placeholder="URL" /><input v-model="whEvents" placeholder="事件(空=全部)" /><button @click="createWh">添加</button><button @click="testWh">测试</button></p>
      <table><tr><th>名称</th><th>URL</th><th>事件</th><th>启用</th><th></th></tr>
        <tr v-for="w in webhooks" :key="w.id"><td>{{ w.name }}</td><td>{{ w.url }}</td><td>{{ w.events || '全部' }}</td><td>{{ w.active }}</td><td><button @click="api.deleteWebhook(w.id).then(load)">删除</button></td></tr>
      </table>
    </div>

    <!-- ssh -->
    <div v-if="tab === 'ssh'">
      <p class="row"><input v-model="sshName" placeholder="名称" /><input v-model="sshHost" placeholder="host" /><input v-model.number="sshPort" placeholder="端口" type="number" /><input v-model="sshUser" placeholder="用户" /><select v-model="sshAuth"><option>password</option><option>privateKey</option></select><input v-model="sshSecret" placeholder="密码/私钥" /><button @click="createSsh">添加</button></p>
      <table><tr><th>名称</th><th>host:port</th><th>用户</th><th>认证</th><th></th></tr>
        <tr v-for="p in ssh" :key="p.id"><td>{{ p.name }}</td><td>{{ p.host }}:{{ p.port }}</td><td>{{ p.user }}</td><td>{{ p.authType }}</td><td><button @click="api.deleteSshProfile(p.id).then(load)">删除</button></td></tr>
      </table>
    </div>

    <!-- http -->
    <div v-if="tab === 'http'">
      <p class="row"><input v-model="httpName" placeholder="名称" /><select v-model="httpAuth"><option>bearer</option><option>basic</option><option>header</option><option>none</option></select><input v-model="httpSecret" placeholder="secret(token 或 user:pass)" /><input v-model="httpHeader" placeholder="header 名(header 类型)" /><button @click="createHttp">添加</button></p>
      <table><tr><th>名称</th><th>认证</th><th>header</th><th></th></tr>
        <tr v-for="c in http" :key="c.id"><td>{{ c.name }}</td><td>{{ c.authType }}</td><td>{{ c.headerName || '-' }}</td><td><button @click="api.deleteHttpCredential(c.id).then(load)">删除</button></td></tr>
      </table>
    </div>

    <!-- linkages -->
    <div v-if="tab === 'linkages'">
      <p class="row"><input v-model="lkName" placeholder="名称" /><input v-model="lkSrc" placeholder="源事件" /><input v-model="lkTgt" placeholder="目标动作" /><select v-model="lkMode"><option>static</option><option>passthrough</option></select><button @click="createLk">添加</button></p>
      <p><textarea v-model="lkInput" rows="3" class="json" placeholder="static 模式的目标输入 JSON" /></p>
      <table><tr><th>名称</th><th>事件</th><th>目标</th><th>模式</th><th>启用</th><th></th></tr>
        <tr v-for="l in linkages" :key="l.id"><td>{{ l.name }}</td><td>{{ l.sourceEventId }}</td><td>{{ l.targetActionId }}</td><td>{{ l.mode }}</td><td>{{ l.enabled }}</td><td><button @click="api.deleteLinkage(l.id).then(load)">删除</button></td></tr>
      </table>
    </div>

    <!-- schedules -->
    <div v-if="tab === 'schedules'">
      <p class="row"><input v-model="scName" placeholder="名称" /><input v-model="scAction" placeholder="动作" /><input v-model="scCron" placeholder="cron" /><button @click="createSc">添加</button> <small>以当前用户 {{ meId || '?' }} 身份执行</small></p>
      <p><textarea v-model="scInput" rows="3" class="json" placeholder="输入 JSON" /></p>
      <table><tr><th>名称</th><th>动作</th><th>cron</th><th>启用</th><th>上次</th><th></th></tr>
        <tr v-for="s in schedules" :key="s.id"><td>{{ s.name }}</td><td>{{ s.actionId }}</td><td>{{ s.cron }}</td><td>{{ s.enabled }}</td><td>{{ s.lastRunAt }}</td><td><button @click="api.deleteSchedule(s.id).then(load)">删除</button></td></tr>
      </table>
    </div>

    <!-- tasks -->
    <div v-if="tab === 'tasks'">
      <table><tr><th>时间</th><th>动作</th><th>主体</th><th>状态</th><th>错误</th></tr>
        <tr v-for="t in tasks" :key="t.id"><td>{{ t.createdAt }}</td><td>{{ t.actionId }}</td><td>{{ t.principalId }}</td><td>{{ t.status }}</td><td>{{ t.errorCode || '' }}</td></tr>
      </table>
    </div>

    <!-- audit -->
    <div v-if="tab === 'audit' && audit">
      <p>共 {{ audit.total }} 条</p>
      <table><tr><th>时间</th><th>主体</th><th>动作</th><th>结果</th><th>耗时ms</th></tr>
        <tr v-for="a in audit.items" :key="a.id"><td>{{ a.createdAt }}</td><td>{{ a.principal }}</td><td>{{ a.actionId }}</td><td>{{ a.ok ? 'ok' : a.errorCode }}</td><td>{{ a.durationMs }}</td></tr>
      </table>
    </div>
  </section>
</template>

<style scoped>
.row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
</style>
