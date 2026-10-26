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

// НОВЫЙ ОДНОРОДНЫЙ ШЛЮЗ БЕЗОПАСНОСТИ ЗАМЕТОК
export const noteAccessProcedure = protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .use(async ({ ctx, next, input }) => {
    // МАГИЯ: Один плоский SQL-запрос вместо каскада проверок
    const access = await ctx.noteService.checkNoteAccess(input.id, ctx.userId);

    // 1. Если заметки нет в базе (или она удалена)
    if (!access.hasAccess && access.accessLevel === null) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Заметка не найдена в системе',
      });
    }

    // 2. Если запись есть, но у пользователя нет к ней никакого отношения
    if (!access.hasAccess) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'У вас нет доступа к этой заметке или родительской папке',
      });
    }

    // 3. Пропускаем запрос дальше, обогащая tRPC-контекст чистыми, однородными типами доступов
    return next({
      ctx: {
        // Вычисляем роль для обратной совместимости, если она нужна UI-мидлварам
        folderRole: access.isOwner ? ('owner' as const) : ('guest' as const),
        // Наш главный однородный уровень доступа: 'read' | 'write' | 'owner'
        folderAccessLevel: access.accessLevel!,
      },
    });
  });

// ==========================================
// 🛡️ 1. СТРОГАЯ ПРОЦЕДУРА ДЛЯ ДЕЙСТВИЙ С САМОЙ ПАПКОЙ
// ==========================================
export const folderScopedProcedure = protectedProcedure
  .input(
    z.object({
      id: z.string().uuid(),
    })
  )
  .use(async ({ ctx, next, input }) => {
    const folderId = input.id;

    const access = await ctx.folderService.checkFolderAccess(
      folderId,
      ctx.userId
    );

    if (!access.hasAccess) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'У вас нет доступа к этой папке',
      });
    }

    return next({
      ctx: {
        targetFolderId: folderId,
        folderRole: access.role!, // 'owner' | 'guest'
        // 🆕 Теперь здесь может прилететь 'read' | 'write' | 'owner'
        folderAccessLevel: access.accessLevel!,
      },
    });
  });

// ==========================================
// 🛡️ 2. ГИБКАЯ ПРОЦЕДУРА ДЛЯ СВЯЗАННЫХ РЕСУРСОВ (ЗАМЕТКИ / ТЕГИ)
// ==========================================
export const rootOrFolderProcedure = protectedProcedure
  .input(
    z.object({
      folderId: z.string().uuid().nullable().optional(),
    })
  )
  .use(async ({ ctx, next, input }) => {
    const { folderId } = input;

    // 📥 Если folderId явно равен null или не передан — это строго Inbox!
    if (folderId === null || folderId === undefined) {
      return next({
        ctx: {
          targetFolderId: null,
          folderRole: 'owner' as const,
          // 🆕 Для Inbox владелец теперь полноценно имеет уровень 'owner'
          folderAccessLevel: 'owner' as const,
        },
      });
    }

    // 📁 Если folderId передан как UUID — жестко проверяем права в базе
    const access = await ctx.folderService.checkFolderAccess(
      folderId,
      ctx.userId
    );

    if (!access.hasAccess) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'У вас нет доступа к этой папке',
      });
    }

    return next({
      ctx: {
        targetFolderId: folderId,
        folderRole: access.role as 'owner' | 'guest',
        // 🆕 Передаем сквозной уровень доступа из базы
        folderAccessLevel: access.accessLevel as 'read' | 'write' | 'owner',
      },
    });
  });

// ==========================================
// 3. СПЕЦИАЛИЗИРОВАННЫЙ ШЛЮЗ ДЛЯ ЦЕЛЕВОЙ ПАПКИ
// ==========================================
export const targetFolderAccessProcedure = protectedProcedure
  .input(
    z.object({
      targetFolderId: z.string().uuid().nullable().optional(), // Парсим правильное имя!
    })
  )
  .use(async ({ ctx, next, input }) => {
    const { targetFolderId } = input;

    // Если перемещаем в Inbox (null/undefined) — права всегда есть (owner личной корзины)
    if (targetFolderId === null || targetFolderId === undefined) {
      return next({
        ctx: {
          targetFolderAccessLevel: 'owner' as const,
        },
      });
    }

    // Проверяем права на целевую папку в базе
    const access = await ctx.folderService.checkFolderAccess(
      targetFolderId,
      ctx.userId
    );

    if (!access.hasAccess) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'У вас нет доступа к целевой папке',
      });
    }

    return next({
      ctx: {
        // Прокидываем уровень доступа к целевой папке в контекст
        targetFolderAccessLevel: access.accessLevel!,
      },
    });
  });
