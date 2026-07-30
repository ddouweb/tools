<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../auth';

const username = ref('admin');
const password = ref('admin');
const err = ref('');
const { login } = useAuth();
const router = useRouter();

async function submit() {
  err.value = '';
  try {
    await login(username.value, password.value);
    router.push('/');
  } catch {
    err.value = '登录失败：账号或密码错误';
  }
}
</script>

<template>
  <form class="login" @submit.prevent="submit">
    <h2>登录 tools</h2>
    <input v-model="username" placeholder="用户名" autocomplete="username" />
    <input v-model="password" type="password" placeholder="密码" autocomplete="current-password" />
    <button type="submit">登录</button>
    <p class="err" v-if="err">{{ err }}</p>
  </form>
</template>

<style scoped>
.login {
  max-width: 320px;
  margin: 4rem auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: #fff;
  padding: 2rem;
  border-radius: 8px;
  border: 1px solid #e1e4e8;
}
</style>
