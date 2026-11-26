import {
  createTRPCReact,
  httpBatchLink,
  httpSubscriptionLink,
  splitLink,
} from '@trpc/react-query';
// Импортируем ТИП роутера из нашего пакета trpc
import type { AppRouter } from '@synapse-kms/trpc';

const apiUrl = '/trpc';

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
        url: apiUrl,
        eventSourceOptions: {
          withCredentials: true, // Разрешает передачу cross-domain кук для SSE
        },
      }),

      // Обычные Queries и Mutations отправляем пачками, как и раньше
      false: httpBatchLink({
        url: apiUrl,
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
