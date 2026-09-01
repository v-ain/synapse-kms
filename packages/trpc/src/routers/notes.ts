import { router, protectedProcedure } from '../trpc.js';
import { z } from 'zod';

// Импортируем Zod-схему, которую вы создали ранее в shared
import {
  BulkMoveSchema,
  CreateNoteSchema,
  getNotesQueryParamsSchema,
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
    .input(CreateNoteSchema) // Zod жестко проверяет входящие данные с фронтенда!
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

  // Пакетное перемещение заметок с оптимистичным замком
  bulkMove: protectedProcedure
    .input(BulkMoveSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.noteService.bulkMove(input, ctx.userId);

      // Если сервис сообщил о конфликте версий данных в базе
      if (result.conflict) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            'Конфликт версий! Данные некоторых заметок были изменены в другом окне.',
        });
      }

      return { success: true };
    }),

  // 💾 Атомарное обновление контента с проверкой версии
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        version: z.number(), // передаем текущую версию с фронтенда
        title: z.string().optional(),
        content: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Вызываем метод сервиса, который проверяет версию в БД перед UPDATE
      const result = await ctx.noteService.updateNote(input, ctx.userId);

      if (result.conflict) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Конфликт версий! Заметка была изменена в другом месте.',
        });
      }

      return result.note!; // возвращаем обновленную заметку (включая новую версию!)
    }),
});
