import { getNotesQueryParamsSchema } from '@synapse-kms/shared';
import { adminProcedure, router } from '../trpc.js';

export const adminRouter = router({
  // Получить список всех пользователей системы для админки
  getNotes: adminProcedure
    .input(getNotesQueryParamsSchema)
    .query(async ({ input, ctx }) => {
      return await ctx.adminService.getNotes(input, ctx.userId);
    }),

  // // Получить вообще все заметки конкретного пользователя
  // getUserNotesGlobal: adminProcedure
  //   .input(z.object({ targetUserId: z.number() }))
  //   .query(async ({ ctx, input }) => {
  //     return await ctx.db
  //       .select()
  //       .from(notes)
  //       .where(eq(notes.userId, input.targetUserId)); // Запрашиваем без привязки к ctx.user.id админа!
  //   }),
});
