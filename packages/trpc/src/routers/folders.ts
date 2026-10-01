import { CreateFolderSchema, DeleteFolderSchema } from '@synapse-kms/shared';
import { router, protectedProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';

export const foldersRouter = router({
  // Получение всех папок пользователя
  getFolders: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.folderService.getFolders(ctx.userId);
  }),

  // Создание новой папки
  create: protectedProcedure
    .input(CreateFolderSchema)
    .mutation(async ({ input, ctx }) => {
      return await ctx.folderService.createFolder(input.title, ctx.userId);
    }),

  // 3. Безопасное удаление папки
  delete: protectedProcedure
    .input(DeleteFolderSchema)
    .mutation(async ({ input, ctx }) => {
      const success = await ctx.folderService.deleteFolder(input, ctx.userId);

      // Если папка не существовала или уже была удалена
      if (!success) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Папка не найдена или уже была удалена',
        });
      }

      return { success: true };
    }),
});
