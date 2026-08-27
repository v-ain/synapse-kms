import { router, publicProcedure } from '../trpc.js';
import { z } from 'zod';

// Импортируем Zod-схему, которую вы создали ранее в shared
import {
  CreateNoteSchema,
  getNotesQueryParamsSchema,
} from '@synapse-kms/shared';
import { TRPCError } from '@trpc/server';

export const notesRouter = router({
  getNotes: publicProcedure
    // Передаем Zod-схему. Она проверит folder_id, limit, cursor и т.д.
    .input(getNotesQueryParamsSchema)
    .query(async ({ input, ctx }) => {
      // 1. Проверяем авторизацию (если у вас приватные заметки)
      if (!ctx.userId) {
        throw new Error('Unauthorized');
      }

      // 2. Вызываем ваш готовый контроллер/сервис, передавая валидированный input и userId
      // input здесь автоматически имеет строгий тип GetNotesQueryParams!
      const result = await ctx.noteService.getNotes(input, ctx.userId);

      return result;
    }),

  // Роут создания заметки
  create: publicProcedure
    .input(CreateNoteSchema) // Zod жестко проверяет входящие данные с фронтенда!
    .mutation(async ({ input, ctx }) => {
      // Проверяем авторизацию
      if (!ctx.userId) throw new Error('Unauthorized');

      // tRPC передает валидный input прямо в ваш готовый контроллер!
      const newNote = await ctx.noteService.createNote(input, ctx.userId);

      return newNote;
    }),

  archive: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const result = await ctx.noteService.archiveNote(input.id, ctx.userId);

      // Если сервис вернул ошибку, превращаем её в понятную для tRPC
      if (result.error) {
        throw new TRPCError({
          code: result.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
          message: result.error,
        });
      }

      return result;
    }),
});
