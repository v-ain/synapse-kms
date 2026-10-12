import { initTRPC, TRPCError } from '@trpc/server';
import z, { ZodError } from 'zod';
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

// 1. Базовый мидлвар авторизации (проверяет наличие userId)
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Для выполнения этого действия необходима авторизация',
    });
  }
  // Передаем userId как гарантированно не-null в следующую цепочку
  return next({ ctx: { userId: ctx.userId } });
});

export const protectedProcedure = t.procedure.use(isAuthed);

// 🔍 Валидатор входного параметра folderId
const folderInputSchema = z.object({
  id: z.string().uuid(),
});

// 2. Создаем процедуру для чтения папки (tRPC v11 style)
// Сначала привязываем инпут, и только потом вызывем .use() — это открывает доступ к свойству `input`
export const folderReadProcedure = protectedProcedure
  .input(folderInputSchema)
  .use(async ({ ctx, next, input }) => {
    // 🚀 Благодаря tRPC v11, `input.folderId` здесь строго типизирован как string!
    const { id } = input;

    const access = await ctx.folderService.checkFolderAccess(id, ctx.userId);

    if (!access.hasAccess) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'У вас нет доступа к этой папке',
      });
    }

    // Обогащаем контекст для следующих шагов или самого роута
    return next({
      ctx: {
        id,
        folderRole: access.role, // 'owner' | 'guest'
        folderAccessLevel: access.accessLevel, // 'read' | 'write'
      },
    });
  });

// 3. Создаем процедуру для записи, расширяя folderReadProcedure
export const folderWriteProcedure = folderReadProcedure.use(({ ctx, next }) => {
  if (ctx.folderAccessLevel !== 'write') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'У вас права только на чтение данных в этой папке',
    });
  }
  return next();
});

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
