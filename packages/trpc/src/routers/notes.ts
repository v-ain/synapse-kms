import { router, protectedProcedure } from '../trpc.js';
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

  // Роут создания заметки
  create: protectedProcedure
    .input(CreateNoteSchema)
    .mutation(async ({ input, ctx }) => {
      // tRPC передает валидный input прямо в ваш готовый контроллер!
      const newNote = await ctx.noteService.createNote(input, ctx.userId);

      return newNote;
    }),

  // Получение одной заметки по ID
  getById: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid({ message: 'Некорректный формат ID заметки' }),
      })
    )
    .query(async ({ input, ctx }) => {
      const note = await ctx.noteService.getNoteById(input.id, ctx.userId);

      if (!note) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Заметка не найдена',
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

  // 💾 Атомарное обновление контента с проверкой версии
  update: protectedProcedure
    .input(UpdateNotePayloadSchema)
    .mutation(async ({ input, ctx }) => {
      // Вызываем метод сервиса, который проверяет версию в БД перед UPDATE
      const note = await ctx.noteService.updateNote(input, ctx.userId);

      if (!note) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Заметка не найдена или у вас нет прав',
        });
      }

      return note;
    }),
});
