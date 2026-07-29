<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getHealth, invokeAction, type Health } from './api';

const health = ref<Health | null>(null);
const echoInput = ref('hello tools');
const echoResult = ref<unknown>(null);
const error = ref<string | null>(null);

async function refresh() {
  error.value = null;
  try {
    health.value = await getHealth();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

async function doEcho() {
  echoResult.value = await invokeAction('echo.echo', { message: echoInput.value });
}

onMounted(refresh);
</script>

<template>
  <main class="wrap">
    <h1>tools <small>统一工具集门户</small></h1>

    <p v-if="error" class="err">
      后端连接失败：{{ error }}（请先启动后端：<code>pnpm --filter @tools/server dev</code>）
    </p>

    <section v-if="health">
      <p>后端状态：<b>{{ health.status }}</b></p>

      <h2>适配器（{{ health.adapters.length }}）</h2>
      <ul>
        <li v-for="a in health.adapters" :key="a.id">
          {{ a.name }} <code>{{ a.id }}</code> v{{ a.version }}
        </li>
      </ul>

      <h2>动作（{{ health.actions.length }}）</h2>
      <ul>
        <li v-for="a in health.actions" :key="a.id">
          {{ a.name }} <code>{{ a.id }}</code> [{{ a.visibility }}]
        </li>
      </ul>
    </section>

    <section>
      <h2>调用 <code>echo.echo</code></h2>
      <input v-model="echoInput" />
      <button @click="doEcho">调用</button>
      <pre>{{ echoResult }}</pre>
    </section>
  </main>
</template>

<style scoped>
.wrap {
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  max-width: 760px;
  margin: 2rem auto;
  padding: 0 1rem;
  color: #222;
}
h1 small {
  color: #888;
  font-weight: normal;
  font-size: 0.6em;
}
code {
  background: #f3f3f3;
  padding: 0 4px;
  border-radius: 3px;
}
.err {
  color: #c00;
}
pre {
  background: #f6f8fa;
  padding: 12px;
  border-radius: 6px;
  overflow: auto;
}
input {
  padding: 6px 8px;
}
button {
  margin-left: 8px;
  padding: 6px 14px;
  cursor: pointer;
}
</style>
