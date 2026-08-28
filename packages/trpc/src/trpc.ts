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

// 🔒 2. Экспортируем готовую защищенную процедуру [health]
export const protectedProcedure = t.procedure.use(isAuthed);
