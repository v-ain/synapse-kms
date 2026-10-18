import { protectedProcedure, router } from '../trpc.js';

export const usersRouter = router({
  // Получить профиль текущего авторизованного пользователя
  getMe: protectedProcedure.query(async ({ ctx }) => {
    // ctx.userId гарантирован мидлваром protectedProcedure
    return await ctx.userService.getUserProfile(ctx.userId);
  }),
  // Получить всех пользователей для меню шеринга
  getAllForShare: protectedProcedure.query(async ({ ctx }) => {
    // Передаем id текущего юзера, чтобы сервис отсек его из выдачи
    return await ctx.userService.getShareableUsers(ctx.userId);
  }),
});
