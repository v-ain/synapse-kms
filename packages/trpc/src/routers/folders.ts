import { router, protectedProcedure } from '../trpc.js';
import { z } from 'zod';

export const foldersRouter = router({
  // Получение всех папок пользователя
  getFolders: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.folderService.getFolders(ctx.userId);
  }),

  // Создание новой папки
  create: protectedProcedure
    .input(
      z.object({
        title: z
          .string()
          .min(1, { message: 'Название папки не может быть пустым' })
          .max(50),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await ctx.folderService.createFolder(input.title, ctx.userId);
    }),

  // Удаление папки по ID
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid({ message: 'Некорректный формат ID папки' }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await ctx.folderService.deleteFolder(input.id, ctx.userId);
      return { success: true };
    }),
});
