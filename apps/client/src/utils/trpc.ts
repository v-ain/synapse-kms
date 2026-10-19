import {
  createTRPCReact,
  httpBatchLink,
  httpSubscriptionLink,
  splitLink,
} from '@trpc/react-query';
// Импортируем ТИП роутера из нашего пакета trpc
import type { AppRouter } from '@synapse-kms/trpc';

// Создаем типизированные хуки tRPC для React
export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    // Разделяем обычные запросы и долгоживущие SSE-подписки
    splitLink({
      // Предикат: если тип операции подписка -> шлем в SSE-линк
      condition: (op) => op.type === 'subscription',

      // Настоящий Server-Sent Events (SSE) канал для подписок
      true: httpSubscriptionLink({
        url: '/trpc',
        // Нативный линк для Server-Sent Events в tRPC v11
        fetch(url, options) {
          return fetch(url, {
            ...options,
            credentials: 'include',
          });
        },
      }),

      // Обычные Queries и Mutations отправляем пачками, как и раньше
      false: httpBatchLink({
        url: '/trpc',
        async headers() {
          return {};
        },
        // Наш проверенный fetch для передачи кук
        fetch(url, options) {
          return fetch(url, {
            ...options,
            credentials: 'include',
          });
        },
      }),
    }),
  ],
});
