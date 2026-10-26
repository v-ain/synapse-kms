import { CreateFolderSchema, DeleteFolderSchema } from '@synapse-kms/shared';
import { router, protectedProcedure, folderScopedProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import z from 'zod';

export const foldersRouter = router({
  // Получение всех папок пользователя
  getFolders: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.folderService.getFolders(ctx.userId);
  }),

  // Создание новой папки
  create: protectedProcedure
    .input(CreateFolderSchema)
    .mutation(async ({ input, ctx }) => {
      // Сервис сам внутри транзакции создаст и папку, и запись в ACL!
      return await ctx.folderService.createFolder(input.title, ctx.userId);
    }),

  // 3. Безопасное удаление папки
  delete: folderScopedProcedure
    .input(DeleteFolderSchema)
    .mutation(async ({ input, ctx }) => {
      // 1. ИСПОЛЬЗУЕМ ACL: Удалять папку может ТОЛЬКО пользователь с уровнем прав 'owner'
      // Кастим к string для dev-режима
      if ((ctx.folderAccessLevel as string) !== 'owner') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Только владелец может удалить эту папку',
        });
      }

      // 2. Вызываем полностью очищенный сервис! Больше не передаем ctx.userId внутрь
      const success = await ctx.folderService.deleteFolder({
        id: ctx.targetFolderId,
        clientUpdatedAt: input.clientUpdatedAt,
      });

      if (!success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Не удалось удалить папку',
        });
      }

      return { success: true };
    }),

  // Мутация для добавления или обновления доступа к папке
  shareFolder: folderScopedProcedure
    .input(
      z.object({
        username: z.string(),
        accessLevel: z.enum(['read', 'write']).default('read'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // 1. ИСПОЛЬЗУЕМ ОДНОРОДНЫЙ ACL: Управлять доступом может ТОЛЬКО пользователь с уровнем 'owner'
      if ((ctx.folderAccessLevel as string) !== 'owner') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'У вас нет прав на управление доступом к этой папке',
        });
      }

      try {
        // 2. Вызываем метод сервиса, передавая проверенный ID папки из контекста безопасности
        const result = await ctx.folderService.shareFolder({
          folderId: ctx.targetFolderId, // 🛡️ Взято из мидлвара
          ownerId: ctx.userId, // Для проверки, чтобы не расшарить самому себе
          username: input.username,
          accessLevel: input.accessLevel,
        });

        return result;
      } catch (error: any) {
        // Обрабатываем понятные ошибки бизнес-логики (пользователь не найден)
        if (error.message.includes('404')) {
          throw new TRPCError({ code: 'NOT_FOUND', message: error.message });
        }
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Не удалось расшарить папку',
        });
      }
    }),
});
