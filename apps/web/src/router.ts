import { createRouter, createWebHistory } from 'vue-router';
import { getToken } from './api';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('./views/LoginView.vue') },
    { path: '/', name: 'home', component: () => import('./views/HomeView.vue') },
    { path: '/actions', name: 'actions', component: () => import('./views/ActionsView.vue') },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('./views/AdminView.vue'),
      meta: { admin: true },
    },
  ],
});

router.beforeEach((to) => {
  if (to.name === 'login') return true;
  if (!getToken()) return { name: 'login' };
  return true;
});
