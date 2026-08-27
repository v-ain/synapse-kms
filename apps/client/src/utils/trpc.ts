import { createTRPCReact } from '@trpc/react-query';
// Импортируем ТИП роутера из нашего пакета trpc
import type { AppRouter } from '@synapse-kms/trpc';

// Создаем типизированные хуки tRPC для React
export const trpc = createTRPCReact<AppRouter>();
