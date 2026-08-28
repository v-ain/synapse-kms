import { router, protectedProcedure } from '../trpc.js';
import { z } from 'zod';

export const tagsRouter = router({
  // Мутация привязки тега к заметке
  attach: protectedProcedure
    .input(
      z.object({
        note_id: z.string().uuid(),
        tag_name: z.string().min(1).max(30).trim(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Вызываем наш только что созданный сервис!
      return await ctx.tagService.attachTag(
        input.note_id,
        input.tag_name,
        ctx.userId
      );
    }),
});
