// 后端 API 客户端（开发期经 Vite 代理 /api -> http://localhost:3000）
const BASE = '/api';

export interface Health {
  status: string;
  adapters: { id: string; name: string; version: string }[];
  actions: { id: string; name: string; visibility: string; tags: string[] }[];
}

export async function getHealth(): Promise<Health> {
  const res = await fetch(`${BASE}/health`);
  if (!res.ok) throw new Error(`health ${res.status}`);
  return res.json() as Promise<Health>;
}

export async function invokeAction(actionId: string, input: unknown): Promise<unknown> {
  const res = await fetch(`${BASE}/actions/${encodeURIComponent(actionId)}/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return res.json();
}
