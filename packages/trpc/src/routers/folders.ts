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
      return await ctx.folderService.createFolder(input.title, ctx.userId);
    }),

  // 3. Безопасное удаление папки
  delete: folderScopedProcedure // Защищаем шлюзом прав на запись
    .input(DeleteFolderSchema) // Передаем полную схему, фронтенд видит все нужные поля
    .mutation(async ({ input, ctx }) => {
      // 1. Проверяем роль, которую мидлвар ОПРЕДЕЛИЛ ПО UUID ИЗ БАЗЫ ДАННЫХ
      // 1. Дополнительная защита: удалять папку может ТОЛЬКО владелец (owner)
      // Гость с правами write (folderAccessLevel === 'write') сюда не пройдёт!
      if (ctx.folderRole !== 'owner') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Только владелец может удалить эту папку',
        });
      }

      // 2. Вызываем сервис. Из контекста берем targetFolderId, который прошел проверку в базе!
      const success = await ctx.folderService.deleteFolder(
        { id: ctx.targetFolderId, clientUpdatedAt: input.clientUpdatedAt },
        ctx.userId
      );

      // Фолбэк на случай, если что-то пошло не так на уровне СУБД
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
        // Поле id валидируется на входе, фронтенд обязан его передать
        targetEmail: z.string().email(),
        accessLevel: z.enum(['read', 'write']).default('read'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // 1. Жёсткая проверка роли: шерить папку может ТОЛЬКО создатель (owner)
      // Гости, даже с правами 'write', не имеют права раздавать чужую папку другим людям!
      if (ctx.folderRole !== 'owner') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'У вас нет прав на управление доступом к этой папке',
        });
      }

      try {
        // 2. Вызываем метод сервиса, передавая 100% проверенный ID из контекста
        const result = await ctx.folderService.shareFolder({
          folderId: ctx.targetFolderId, // 🛡️ Никаких input.id, только защищенный контекст мидлвара!
          ownerId: ctx.userId,
          targetEmail: input.targetEmail,
          accessLevel: input.accessLevel,
        });

        return result;
      } catch (error: any) {
        // Обрабатываем понятные ошибки из бизнес-логики
        if (error.message.includes('404')) {
          throw new TRPCError({ code: 'NOT_FOUND', message: error.message });
        }
        if (error.message.includes('403')) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Доступ запрещен',
          });
        }
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Не удалось расшарить папку',
        });
      }
    }),
});
