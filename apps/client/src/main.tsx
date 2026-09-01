import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
// import './index.css';
import './styles/variables.css';
import './styles/ranger.css';
import { trpc } from './utils/trpc.ts';
import { httpBatchLink } from '@trpc/client';

// 🎯 Создаем единый экземпляр кэш-движка с промышленными дефолтами
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Данные считаются свежими 5 минут (нет лишних RPS к Fastify)
      gcTime: 1000 * 60 * 10, // Неактивный кэш полностью стирается из RAM браузера через 10 минут
      refetchOnWindowFocus: true, // Фоновое обновление при возвращении на вкладку приложения
    },
  },
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: '/trpc', // URL вашего Fastify сервера

      // 🛠️ Магия авторизации: автоматически прокидываем заголовок x-user-id на КАЖДЫЙ запрос
      headers() {
        return {
          'x-user-id': '11111111-1111-1111-1111-111111111111', // Пока тестовый, потом возьмем из стора
        };
      },
    }),
  ],
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  </React.StrictMode>
);
