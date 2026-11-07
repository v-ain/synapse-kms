import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Укажите каталог, где находится .env.local (ваш корневой каталог проекта)
  const envDir = path.resolve(import.meta.dirname, '../../.env.local');
  // Третий параметр '' означает загрузку всех переменных, не ограничиваясь префиксом VITE_
  const env = loadEnv(mode, envDir);

  // Читаем VITE_API_URL, указываем значение по умолчанию для предотвращения ошибок
  const apiTarget = env.VITE_API_URL || 'http://localhost:3037';

  return {
    // Ваш исходный envDir оставьте без изменений, он используется для клиентского кода
    envDir,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/trpc': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: './src/setupTests.ts',
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
  };
});
