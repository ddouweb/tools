<script setup lang="ts">
import { computed } from 'vue';
import { RouterView, RouterLink, useRouter } from 'vue-router';
import { useAuth } from './auth';

const { state, logout } = useAuth();
const router = useRouter();
const logged = computed(() => !!state.user);

function doLogout() {
  logout();
  router.push('/login');
}
</script>

<template>
  <div class="app">
    <header class="nav" v-if="logged">
      <span class="brand">tools</span>
      <RouterLink to="/">概览</RouterLink>
      <RouterLink to="/actions">动作</RouterLink>
      <RouterLink to="/admin" v-if="state.user?.isAdmin">管理</RouterLink>
      <span class="spacer" />
      <span class="user">{{ state.user?.username }}</span>
      <button @click="doLogout">登出</button>
    </header>
    <main><RouterView /></main>
  </div>
</template>

<style>
:root {
  color-scheme: light;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  background: #f6f7f9;
  color: #1f2328;
}
.app {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 1rem 3rem;
}
.nav {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 0;
  border-bottom: 1px solid #e1e4e8;
}
.nav .brand {
  font-weight: 700;
}
.nav .spacer {
  flex: 1;
}
.nav a {
  color: #1f2328;
  text-decoration: none;
  padding: 4px 8px;
  border-radius: 6px;
}
.nav a.router-link-active {
  background: #eaeef2;
}
.nav .user {
  color: #57606a;
  font-size: 0.9rem;
}
button,
input,
select,
textarea {
  font: inherit;
  padding: 6px 8px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: #fff;
}
button {
  cursor: pointer;
  background: #2da44e;
  color: #fff;
  border: none;
}
button:hover {
  background: #218838;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.5rem;
  background: #fff;
}
th,
td {
  border: 1px solid #eaeef2;
  padding: 6px 8px;
  text-align: left;
  font-size: 0.9rem;
}
th {
  background: #f6f8fa;
}
pre {
  background: #0d1117;
  color: #c9d1d9;
  padding: 12px;
  border-radius: 6px;
  overflow: auto;
}
.err {
  color: #cf222e;
}
code {
  background: #eaeef2;
  padding: 0 4px;
  border-radius: 3px;
}
.tabs button {
  margin-right: 4px;
  background: #eaeef2;
  color: #1f2328;
}
.tabs button.on {
  background: #2da44e;
  color: #fff;
}
.json {
  width: 100%;
  font-family: ui-monospace, monospace;
}
</style>
