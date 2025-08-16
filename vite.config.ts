// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    /*  روی همهٔ IPهای کارت شبکه شنود می‌کند → کل شبکه به پورت 5173 دسترسی دارد */
    host: '0.0.0.0',
    port: 5173,

    /*  درخواست‌های فرانت را به بک-اند لوکال (Express) فوروارد می‌کند  */
    proxy: {
      '/api': {
        target: 'http://192.168.1.106:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://192.168.1.106:3001',
        changeOrigin: true,
      },
    },
  },
});
