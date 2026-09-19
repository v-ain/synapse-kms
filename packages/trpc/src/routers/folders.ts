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
    .input(DeleteFolderSchema) // Используем общую схему
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.folderService.deleteFolder(input.id, ctx.userId);

      // сужение типа
      if (result.error !== null) {
        throw new TRPCError({
          code: result.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
          message: result.error,
        });
      }

      return { success: true };
    }),
});
