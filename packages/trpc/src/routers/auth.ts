import { router, publicProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { loginSchema, registerSchema } from '@synapse-kms/shared';

export const authRouter = router({
  // 1. РЕГИСТРАЦИЯ (С расширенным DDD-инпутом)
  register: publicProcedure
    .input(registerSchema) // Защищает эндпоинт правилами для никнейма
    .mutation(async ({ input, ctx }) => {
      // Передаем весь input целиком в AuthService (он теперь ждет email, password, username, displayName)
      const newUser = await ctx.authService.registerUser(input);

      // Сразу после успешной регистрации генерируем JWT токен
      const token = ctx.authService.generateToken(newUser.id, newUser.role);

      if (ctx.setAuthCookie) {
        ctx.setAuthCookie(token);
      }

      // Возвращаем фронтенду безопасный DTO (без приватных полей и хэшей паролей)
      return {
        success: true,
        user: {
          id: newUser.id,
          username: newUser.username,
          role: newUser.role,
        },
      };
    }),

  // 2. ВХОД (Логин использует чистый loginSchema без никнейма)
  login: publicProcedure
    .input(loginSchema) // При входе просим строго email и password
    .mutation(async ({ input, ctx }) => {
      const { email, password } = input;

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

      // Так как email на клиенте больше не светится, для сессии отдаем id и роль
      return {
        success: true,
        user: { id: user.id, username: user.username, role: user.role },
      };
    }),

  // 🚪 3. ВЫХОД
  logout: publicProcedure.mutation(({ ctx }) => {
    if (ctx.setAuthCookie) {
      ctx.setAuthCookie('');
    }
    return { success: true };
  }),
});
