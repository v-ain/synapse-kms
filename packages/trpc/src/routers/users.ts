import { protectedProcedure, router } from '../trpc.js';

export const usersRouter = router({
  // Получить всех пользователей для меню шеринга
  getAllForShare: protectedProcedure.query(async ({ ctx }) => {
    // Передаем id текущего юзера, чтобы сервис отсек его из выдачи
    return await ctx.userService.getShareableUsers(ctx.userId);
  }),
});
