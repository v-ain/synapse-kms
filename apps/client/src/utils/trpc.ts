import { createTRPCReact, httpBatchLink } from '@trpc/react-query';
// Импортируем ТИП роутера из нашего пакета trpc
import type { AppRouter } from '@synapse-kms/trpc';

// Создаем типизированные хуки tRPC для React
export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/trpc', // URL твоего Fastify сервера

      // 🪄 КРИТИЧЕСКИ ВАЖНО ДЛЯ КУК: заставляет браузер отправлять HttpOnly куки с каждым запросом tRPC!
      async headers() {
        return {};
      },
      // Добавляем нативный fetch-параметр для передачи кук
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include', // 🚀 ВКЛЮЧАЕМ СКВОЗНЫЕ КУКИ ДЛЯ КРОСС-ПОРТОВ!
        });
      },
    }),
  ],
});
