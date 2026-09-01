import { initTRPC, TRPCError } from '@trpc/server';
import { type Context } from './context.js';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// 🛡️ 1. Создаем middleware для проверки авторизации [health]
const isAuthed = t.middleware(({ ctx, next }) => {
  // Если контекст не смог расшифровать куку и userId равен null — даем от ворот поворот
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Для выполнения этого действия необходима авторизация',
    });
  }

  // Если всё ок, передаем управление дальше.
  // Благодаря магии TypeScript, в следующем звене ctx.userId автоматически станет СТРОГОЙ строкой (не null)!
  return next({
    ctx: {
      userId: ctx.userId, // сужаем тип до string
    },
  });
});

// 2. Экспортируем готовую защищенную процедуру [health]
export const protectedProcedure = t.procedure.use(isAuthed);

// 3. Создаем middleware для проверки роли АДМИНИСТРАТОРА
const isAdmin = t.middleware(({ ctx, next }) => {
  // ⚠️ ВАЖНО: Предполагаем, что роль лежит в ctx.userRole или вы достаете её из вашей сессии/БД в контексте.
  // Замените `ctx.userRole` на то, как это поле называется у вас в context.ts
  if (ctx.userRole !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN', // Код 403 (Запрещено), так как юзер авторизован, но у него нет прав
      message: 'Доступ ограничен. Требуются права администратора',
    });
  }

  return next({
    ctx: {
      userId: ctx.userId,
      userRole: ctx.userRole, // Передаем роль дальше по контексту
    },
  });
});

// 🔒 4. Экспортируем готовую защищенную процедуру для АДМИНКИ
// Магия tRPC: эта процедура СНАЧАЛА запустит проверку авторизации (isAuthed),
// и только если она прошла успешна — запустит проверку роли (isAdmin)!
export const adminProcedure = t.procedure.use(isAuthed).use(isAdmin);
