<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api';

type Tab = 'users' | 'roles' | 'webhooks' | 'audit';
const tab = ref<Tab>('users');

const users = ref<any[]>([]);
const roles = ref<any[]>([]);
const webhooks = ref<any[]>([]);
const audit = ref<{ total: number; items: any[] } | null>(null);

const whName = ref('');
const whUrl = ref('');
const whEvents = ref('');
const err = ref('');

async function load() {
  try {
    err.value = '';
    [users.value, roles.value] = await Promise.all([api.users(), api.roles()]);
    if (tab.value === 'webhooks') webhooks.value = await api.webhooks();
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
  whName.value = '';
  whUrl.value = '';
  whEvents.value = '';
  await load();
}

async function delWh(id: string) {
  await api.deleteWebhook(id);
  await load();
}

async function testWh() {
  await api.testWebhook();
  alert('已向所有启用的 webhook 发送测试通知');
}

onMounted(load);
</script>

<template>
  <section>
    <h2>管理</h2>
    <nav class="tabs">
      <button :class="{ on: tab === 'users' }" @click="selectTab('users')">用户</button>
      <button :class="{ on: tab === 'roles' }" @click="selectTab('roles')">角色</button>
      <button :class="{ on: tab === 'webhooks' }" @click="selectTab('webhooks')">Webhooks</button>
      <button :class="{ on: tab === 'audit' }" @click="selectTab('audit')">审计</button>
    </nav>
    <p class="err" v-if="err">{{ err }}</p>

    <div v-if="tab === 'users'">
      <table>
        <tr><th>用户名</th><th>状态</th><th>角色</th></tr>
        <tr v-for="u in users" :key="u.id">
          <td>{{ u.username }}</td><td>{{ u.status }}</td>
          <td>{{ u.roles.map((r: any) => r.name).join(', ') }}</td>
        </tr>
      </table>
    </div>

    <div v-if="tab === 'roles'">
      <table>
        <tr><th>角色</th><th>isAdmin</th><th>权限</th><th>用户数</th></tr>
        <tr v-for="r in roles" :key="r.id">
          <td>{{ r.name }}</td><td>{{ r.isAdmin }}</td>
          <td>{{ r.permissions.map((p: any) => p.permission.key).join(', ') }}</td>
          <td>{{ r._count?.users }}</td>
        </tr>
      </table>
    </div>

    <div v-if="tab === 'webhooks'">
      <p class="row">
        <input v-model="whName" placeholder="名称" />
        <input v-model="whUrl" placeholder="URL" />
        <input v-model="whEvents" placeholder="事件(空=全部)" />
        <button @click="createWh">添加</button>
        <button @click="testWh">测试</button>
      </p>
      <table>
        <tr><th>名称</th><th>URL</th><th>事件</th><th>启用</th><th></th></tr>
        <tr v-for="w in webhooks" :key="w.id">
          <td>{{ w.name }}</td><td>{{ w.url }}</td><td>{{ w.events || '全部' }}</td><td>{{ w.active }}</td>
          <td><button @click="delWh(w.id)">删除</button></td>
        </tr>
      </table>
    </div>

    <div v-if="tab === 'audit' && audit">
      <p>共 {{ audit.total }} 条</p>
      <table>
        <tr><th>时间</th><th>主体</th><th>动作</th><th>结果</th><th>耗时ms</th></tr>
        <tr v-for="a in audit.items" :key="a.id">
          <td>{{ a.createdAt }}</td><td>{{ a.principal }}</td><td>{{ a.actionId }}</td>
          <td>{{ a.ok ? 'ok' : a.errorCode }}</td><td>{{ a.durationMs }}</td>
        </tr>
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
</style>
