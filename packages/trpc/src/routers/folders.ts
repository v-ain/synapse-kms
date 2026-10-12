import { CreateFolderSchema, DeleteFolderSchema } from '@synapse-kms/shared';
import { router, protectedProcedure, folderWriteProcedure } from '../trpc.js';
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
  delete: folderWriteProcedure // Защищаем шлюзом прав на запись
    .input(
      z.object({
        clientUpdatedAt: z.string().datetime({ offset: true }), // Валидируем ISO таймстемп с фронта
      })
    )
    .mutation(async ({ input, ctx }) => {
      // 1. Дополнительная защита: удалять папку может ТОЛЬКО владелец (owner)
      // Гость с правами write (folderAccessLevel === 'write') сюда не пройдёт!
      if (ctx.folderRole !== 'owner') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Только владелец может удалить эту папку',
        });
      }

      // 2. Вызываем сервис. Так как мидлвар уже вытащил folderId, берем его из контекста
      const success = await ctx.folderService.deleteFolder(
        { id: ctx.id, clientUpdatedAt: input.clientUpdatedAt },
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
  shareFolder: folderWriteProcedure // 🚀 Защищаем шлюзом: только те, у кого есть права на запись (Владелец)
    .input(
      z.object({
        id: z.string().uuid(),
        targetEmail: z.string().email(), // 🚀 Безопасный инпут по Email вместо UUID
        accessLevel: z.enum(['read', 'write']).default('read'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // Вызываем наш обновленный метод сервиса
        const result = await ctx.folderService.shareFolder({
          folderId: ctx.id, // Поле folderId мидлвар автоматически положил в ctx!
          ownerId: ctx.userId,
          targetEmail: input.targetEmail,
          accessLevel: input.accessLevel,
        });

        return result;
      } catch (error: any) {
        // Ловим понятные ошибки из бизнес-логики сервиса и прокидываем их на фронтенд через tRPC
        if (error.message.includes('404')) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message,
          });
        }
        if (error.message.includes('403')) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'У вас нет прав на управление доступом к этой папке',
          });
        }
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error.message || 'Не удалось расшарить папку',
        });
      }
    }),
});
