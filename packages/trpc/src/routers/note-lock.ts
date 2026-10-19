import { z } from 'zod';
import { protectedProcedure, router } from '../trpc.js';
import { LOCK_EVENTS, type NoteLockInfo } from '@synapse-kms/shared';
import { tracked } from '@trpc/server';

// Описываем тип того, что летит в событии шины
interface LockUpdatedEventPayload {
  noteId: string;
  lock: NoteLockInfo;
}

export const notesLockRouter = router({
  // 1. Попытка захватить блокировку перед открытием инпута
  acquireLock: protectedProcedure
    .input(z.object({ noteId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Вызываем наш Redis-backed сервис
      return await ctx.noteLockService.acquire(input.noteId, ctx.userId);
    }),

  // 2. Heartbeat дебаунс-продление (вызывается фронтом каждые ~10 сек)
  renewLock: protectedProcedure
    .input(z.object({ noteId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.noteLockService.renew(input.noteId, ctx.userId);
    }),

  // 3. Явное освобождение (когда юзер нажал "Закрыть" или ушел с роута)
  releaseLock: protectedProcedure
    .input(z.object({ noteId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.noteLockService.release(input.noteId, ctx.userId);
    }),

  /**
   * РЕАКТИВНЫЙ SSE-ПОТОК БЛОКИРОВОК
   * Клиент подписывается на этот эндпоинт и получает дельту изменений в реальном времени.
   */
  onLockStatusChanged: protectedProcedure.subscription(async function* (opts) {
    const { ctx } = opts; // Достаем контекст процедуры
    const eventQueue: LockUpdatedEventPayload[] = [];

    const listener = (data: LockUpdatedEventPayload) => {
      eventQueue.push(data);
    };

    ctx.eventEmitter.on(LOCK_EVENTS.LOCK_UPDATED, listener);

    try {
      while (true) {
        while (eventQueue.length > 0) {
          const event = eventQueue.shift();
          if (event) {
            // Используем актуальный хелпер tracked(id, data)
            yield tracked(event.noteId, event.lock);
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } finally {
      // Защита от утечек памяти при отключении клиента
      ctx.eventEmitter.off(LOCK_EVENTS.LOCK_UPDATED, listener);
    }
  }),
});
