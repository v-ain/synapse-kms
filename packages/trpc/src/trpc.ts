import { initTRPC, TRPCError } from '@trpc/server';
import { ZodError } from 'zod';
import { type Context } from './context.js';

// Инициализируем tRPC с форматтером ошибок
const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        code: shape.data.code,
        httpStatus: shape.data.httpStatus,
        // Скрываем пути к файлам сервера в продакшене, чтобы у хакеров не было зацепок
        stack:
          process.env.NODE_ENV === 'production' ? undefined : shape.data.stack,
        // Удобно прокидываем плоский массив наших код-ключей (TITLE_EMPTY и т.д.)
        zodError:
          error.cause instanceof ZodError
            ? error.cause.flatten((issue) => issue.message)
            : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Для выполнения этого действия необходима авторизация',
    });
  }

  return next({
    ctx: {
      userId: ctx.userId,
    },
  });
});

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
