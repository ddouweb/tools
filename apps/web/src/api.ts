const BASE = '/api';

export class UnauthorizedError extends Error {}

export function getToken(): string | null {
  return localStorage.getItem('tools.token');
}
export function setToken(t: string | null): void {
  if (t) localStorage.setItem('tools.token', t);
  else localStorage.removeItem('tools.token');
}

export interface AuthUser {
  id: string;
  username: string;
  isAdmin: boolean;
  email?: string | null;
}

async function req(path: string, opts: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((opts.headers as Record<string, string> | undefined) ?? {}),
  };
  const tok = getToken();
  if (tok) headers['Authorization'] = `Bearer ${tok}`;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (res.status === 401) {
    setToken(null);
    throw new UnauthorizedError();
  }
  return res.json();
}

// Action 调用的失败（FORBIDDEN 等）仍返回 200 + {ok:false}；调用方据 .ok 判断。
export const api = {
  login: (username: string, password: string) =>
    req('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => req('/auth/me'),
  health: () => req('/health'),

  invoke: (actionId: string, input: unknown) =>
    req(`/actions/${encodeURIComponent(actionId)}/invoke`, { method: 'POST', body: JSON.stringify(input) }),
  submit: (actionId: string, input: unknown) =>
    req(`/actions/${encodeURIComponent(actionId)}/submit`, { method: 'POST', body: JSON.stringify(input) }),
  listTasks: () => req('/tasks'),
  getTask: (id: string) => req(`/tasks/${id}`),

  // admin
  users: () => req('/admin/users'),
  createUser: (b: unknown) => req('/admin/users', { method: 'POST', body: JSON.stringify(b) }),
  roles: () => req('/admin/roles'),
  permissions: () => req('/admin/permissions'),
  webhooks: () => req('/admin/notifications/webhooks'),
  createWebhook: (b: unknown) =>
    req('/admin/notifications/webhooks', { method: 'POST', body: JSON.stringify(b) }),
  deleteWebhook: (id: string) => req(`/admin/notifications/webhooks/${id}`, { method: 'DELETE' }),
  testWebhook: () => req('/admin/notifications/test', { method: 'POST' }),
  audit: (query: string) => req(`/admin/audit?${query}`),

  // 任务
  tasks: () => req('/tasks'),
  // ssh profiles
  sshProfiles: () => req('/admin/ssh/profiles'),
  createSshProfile: (b: unknown) => req('/admin/ssh/profiles', { method: 'POST', body: JSON.stringify(b) }),
  deleteSshProfile: (id: string) => req(`/admin/ssh/profiles/${id}`, { method: 'DELETE' }),
  // http credentials
  httpCredentials: () => req('/admin/http/credentials'),
  createHttpCredential: (b: unknown) => req('/admin/http/credentials', { method: 'POST', body: JSON.stringify(b) }),
  deleteHttpCredential: (id: string) => req(`/admin/http/credentials/${id}`, { method: 'DELETE' }),
  // linkages
  linkages: () => req('/admin/linkages'),
  createLinkage: (b: unknown) => req('/admin/linkages', { method: 'POST', body: JSON.stringify(b) }),
  deleteLinkage: (id: string) => req(`/admin/linkages/${id}`, { method: 'DELETE' }),
  // schedules
  schedules: () => req('/admin/schedules'),
  createSchedule: (b: unknown) => req('/admin/schedules', { method: 'POST', body: JSON.stringify(b) }),
  deleteSchedule: (id: string) => req(`/admin/schedules/${id}`, { method: 'DELETE' }),
};
