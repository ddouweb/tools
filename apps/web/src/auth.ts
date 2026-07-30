import { reactive } from 'vue';
import { api, setToken, getToken, type AuthUser } from './api';

const state = reactive<{ user: AuthUser | null; ready: boolean }>({ user: null, ready: false });

export function useAuth() {
  async function init(): Promise<void> {
    if (getToken()) {
      try {
        state.user = await api.me();
      } catch {
        setToken(null);
        state.user = null;
      }
    }
    state.ready = true;
  }

  async function login(username: string, password: string) {
    const r = await api.login(username, password);
    setToken(r.accessToken);
    state.user = r.user;
    return r;
  }

  function logout(): void {
    setToken(null);
    state.user = null;
  }

  return { state, init, login, logout };
}
