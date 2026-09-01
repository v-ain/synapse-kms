import { router, publicProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { authCredentialsSchema } from '@synapse-kms/shared';

// // Настройки куки: HttpOnly, защита от CSRF через SameSite=Strict, кука живет 7 дней [health]
// const COOKIE_OPTIONS = {
//   path: '/',
//   httpOnly: true,
//   secure: process.env.NODE_ENV === 'production',
//   sameSite: 'strict' as const,
//   maxAge: 60 * 60 * 24 * 7, // 7 дней в секундах
// };

export const authRouter = router({
  // 📝 1. РЕГИСТРАЦИЯ ПОЛЬЗОВАТЕЛЯ (Исправленный вариант)
  register: publicProcedure
    .input(authCredentialsSchema)
    .mutation(async ({ input, ctx }) => {
      const { email, password } = input;

      try {
        const newUser = await ctx.authService.registerUser(email, password);

        // Сразу после регистрации генерируем токен и логиним юзера [health]
        const token = ctx.authService.generateToken(newUser.id, newUser.role);
        if (ctx.setAuthCookie) {
          ctx.setAuthCookie(token);
        }

        return {
          success: true,
          user: { id: newUser.id, email: newUser.email },
        };
      } catch (err: any) {
        // Если база выкинула ошибку уникальности email (unique constraint)
        if (err.code === '23505') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Пользователь с таким email уже зарегистрирован',
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Ошибка при регистрации пользователя',
        });
      }
    }),

  // 🔑 2. ВХОД (ЛОГИН)
  login: publicProcedure
    .input(authCredentialsSchema)
    .mutation(async ({ input, ctx }) => {
      const { email, password } = input;

      // Здесь нам нужно найти пользователя по email.
      // Бро, если в контексте нет прямой ссылки на `db` (так как мы решили ходить через сервисы),
      // то поиск юзера по email и инсерт при регистрации лучше всего дописать методами внутрь вашего `AuthService`!
      // Давай перенаправим вызов в AuthService, чтобы не нарушать архитектуру.

      const user = await ctx.authService.validateUser(email, password);

      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Неверный email или пароль',
        });
      }

      // Генерируем JWT токен
      const token = ctx.authService.generateToken(user.id, user.role);

      if (ctx.setAuthCookie) {
        ctx.setAuthCookie(token);
      }

      return { success: true, user: { id: user.id, email: user.email } };
    }),

  // 🚪 3. ВЫХОД (ЛОГАУТ)
  logout: publicProcedure.mutation(({ ctx }) => {
    if (ctx.setAuthCookie) {
      ctx.setAuthCookie('');
    }
    return { success: true };
  }),
});
