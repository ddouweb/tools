<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../api';

interface Health {
  status: string;
  adapters: { id: string; name: string; version: string }[];
  actions: { id: string; name: string; visibility: string; tags: string[] }[];
}

const health = ref<Health | null>(null);
const err = ref('');

onMounted(async () => {
  try {
    health.value = await api.health();
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e);
  }
});
</script>

<template>
  <section>
    <h2>概览</h2>
    <p v-if="err" class="err">{{ err }}</p>
    <div v-if="health">
      <h3>适配器（{{ health.adapters.length }}）</h3>
      <ul>
        <li v-for="a in health.adapters" :key="a.id">{{ a.name }} <code>{{ a.id }}</code> v{{ a.version }}</li>
      </ul>
      <h3>动作（{{ health.actions.length }}）</h3>
      <ul>
        <li v-for="a in health.actions" :key="a.id">{{ a.name }} <code>{{ a.id }}</code> [{{ a.visibility }}]</li>
      </ul>
    </div>
  </section>
</template>
