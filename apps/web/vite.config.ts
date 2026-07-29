import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// 开发期把 /api 代理到后端(:3000)，前端代码用相对路径 /api 调用即可。
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
});
