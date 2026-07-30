<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api';

const actions = ref<{ id: string; name: string }[]>([]);
const actionId = ref('echo.echo');
const inputText = ref('{\n  "message": "hello"\n}');
const result = ref<unknown>(null);
const err = ref('');

onMounted(async () => {
  const h = await api.health();
  actions.value = h.actions;
});

async function invoke() {
  err.value = '';
  result.value = null;
  try {
    const input = JSON.parse(inputText.value || '{}');
    result.value = await api.invoke(actionId.value, input);
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
}
</script>

<template>
  <section>
    <h2>调用动作</h2>
    <p>
      <select v-model="actionId">
        <option v-for="a in actions" :key="a.id" :value="a.id">{{ a.id }}</option>
      </select>
    </p>
    <h4>输入（JSON）</h4>
    <textarea v-model="inputText" rows="8" class="json" />
    <p><button @click="invoke">调用</button></p>
    <p class="err" v-if="err">{{ err }}</p>
    <pre v-if="result !== null">{{ result }}</pre>
  </section>
</template>
