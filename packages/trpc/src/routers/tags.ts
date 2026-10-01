import { AttachTagSchema } from '@synapse-kms/shared';
import { router, protectedProcedure } from '../trpc.js';

export const tagsRouter = router({
  // Мутация привязки тега к заметке
  attach: protectedProcedure
    .input(AttachTagSchema)
    .mutation(async ({ input, ctx }) => {
      return await ctx.tagService.attachTag(input, ctx.userId);
    }),

  // Эндпоинт получения всех тегов пользователя для Сайдбара
  list: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.tagService.getUserTags(ctx.userId);
  }),
});
