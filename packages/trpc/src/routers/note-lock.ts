import { z } from 'zod';
import { protectedProcedure, router } from '../trpc.js';

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
});
