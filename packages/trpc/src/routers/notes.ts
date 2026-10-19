import {
  router,
  protectedProcedure,
  rootOrFolderProcedure,
  noteAccessProcedure,
} from '../trpc.js';
import { z } from 'zod';

// Импортируем Zod-схему, которую вы создали ранее в shared
import {
  BulkMovePayloadSchema,
  CreateNoteSchema,
  getNotesQueryParamsSchema,
  UpdateNotePayloadSchema,
} from '@synapse-kms/shared';
import { TRPCError } from '@trpc/server';

export const notesRouter = router({
  getNotes: protectedProcedure
    // Передаем Zod-схему. Она проверит folder_id, limit, cursor и т.д.
    .input(getNotesQueryParamsSchema)
    .query(async ({ input, ctx }) => {
      // Никаких 'if (!ctx.userId)'! TypeScript знает, что ctx.userId здесь железобетонно string!
      return await ctx.noteService.getNotes(input, ctx.userId);
    }),

  create: rootOrFolderProcedure
    .input(CreateNoteSchema) // Склеиваем схемы. На входе будет полный контракт заметки
    .mutation(async ({ input, ctx }) => {
      // 1. Проверяем уровень доступа, который мидлвар УЖЕ посчитал (для папки или для Inbox)
      if (ctx.folderAccessLevel !== 'write') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'У вас нет прав на создание заметок в этой папке',
        });
      }

      // 2. Вызываем сервис заметок. Данные о папке берем строго из контекста безопасности!
      const newNote = await ctx.noteService.createNote(
        {
          ...input,
          folderId: ctx.targetFolderId, // 🛡️ Передаем проверенный UUID или null (для Inbox)
        },
        ctx.userId
      );

      return newNote;
    }),

  // Получение одной заметки по ID
  getById: noteAccessProcedure // 🚀 Защищаем шлюзом проверки папки/авторства
    .query(async ({ input, ctx }) => {
      // Метод просто забирает данные, так как охрана на входе уже всё проверила
      const note = await ctx.noteService.getNoteById(input.id);

      if (!note) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Заметка не найдена в базе данных',
        });
      }

      return note;
    }),

  archive: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid({ message: 'Некорректный формат ID заметки' }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.noteService.archiveNote(input.id, ctx.userId);

      // Если в вашей бизнес-логике сервиса произошла ошибка (например, 404)
      if (result.error) {
        throw new TRPCError({
          code: result.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
          message: result.error,
        });
      }

      return { success: true };
    }),

  // Пакетное перемещение заметок с атомарным разрешением гонок (LWW)
  bulkMove: protectedProcedure
    .input(BulkMovePayloadSchema)
    .mutation(async ({ input, ctx }) => {
      // Сервис сам обработает сетевые гонки для каждой заметки отдельно
      const result = await ctx.noteService.bulkMove(input, ctx.userId);

      // Возвращаем фронтенду флаг успеха и массив ID перемещенных заметок
      return {
        success: result.success,
        movedIds: result.movedIds,
      };
    }),

  // Атомарное обновление контента с проверкой версии
  update: noteAccessProcedure // ОХРАНА: Проверяет существование заметки и доступ к папке
    .input(UpdateNotePayloadSchema)
    .mutation(async ({ input, ctx }) => {
      // 1. БЕЗОПАСНОСТЬ СЛОЯ: Гости с уровнем доступа 'read' не могут изменять контент!
      if (ctx.folderAccessLevel !== 'write') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'У вас есть права только на чтение заметок в этой папке',
        });
      }

      // 2. Передаем инпут в сервис (без userId, доверяя мидлвару)
      const result = await ctx.noteService.updateNote(input, ctx.userId);

      if (!result.note) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Заметка не найдена в базе данных',
        });
      }

      // 3. ⚠️ ОБРАБОТКА КОНФЛИКТА СИНХРОНИЗАЦИИ (Честный LWW)
      if (result.isRejected) {
        throw new TRPCError({
          code: 'CONFLICT', // Отдаем статус 409
          message:
            'Изменения отклонены. В базе данных уже есть более свежая версия документа.',
          // Прокидываем актуальную версию заметки, чтобы клиент мог перетереть свой локальный кэш
          cause: result.note,
        });
      }

      return result.note;
    }),
});
