import { AttachTagSchema } from '@synapse-kms/shared';
import { router, protectedProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';

export const tagsRouter = router({
  // Привязка тега к заметке
  attach: protectedProcedure
    .input(AttachTagSchema) // Ожидает { noteId: string, tagName: string }
    .mutation(async ({ input, ctx }) => {
      // 🛡️ ОХРАНА: Проверяем, принадлежит ли заметка текущему пользователю,
      // прежде чем разрешить вешать на неё теги!
      const note = await ctx.noteService.getNoteById(input.noteId, ctx.userId);
      if (!note) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Заметка не найдена или у вас нет прав на её редактирование',
        });
      }

      return await ctx.tagService.attachTag(input, ctx.userId);
    }),

  // Эндпоинт получения всех тегов пользователя для Сайдбара
  list: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.tagService.getUserTags(ctx.userId);
  }),
});
