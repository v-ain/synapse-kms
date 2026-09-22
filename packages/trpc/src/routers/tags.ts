import { AttachTagSchema } from '@synapse-kms/shared';
import { router, protectedProcedure } from '../trpc.js';

export const tagsRouter = router({
  // Мутация привязки тега к заметке
  attach: protectedProcedure
    .input(AttachTagSchema)
    .mutation(async ({ input, ctx }) => {
      // Вызываем наш только что созданный сервис!
      return await ctx.tagService.attachTag(input, ctx.userId);
    }),
});
