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

// ПРОЦЕДУРА ПРОВЕРКИ ДОСТУПА К КОНКРЕТНОЙ ЗАМЕТКЕ (tRPC v11)
export const noteAccessProcedure = protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .use(async ({ ctx, next, input }) => {
    // Вызываем метод через уже существующий в контексте noteService!
    const noteMeta = await ctx.noteService.getNoteMeta(input.id);

    if (!noteMeta) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Заметка не найдена' });
    }

    // Если это Inbox — читать может только автор
    if (!noteMeta.folderId) {
      if (noteMeta.userId !== ctx.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'У вас нет доступа к этой личной заметке',
        });
      }
      return next({
        ctx: {
          folderRole: 'owner' as const,
          folderAccessLevel: 'write' as const,
        },
      });
    }

    // Если это папка — делегируем безопасность папкам
    const access = await ctx.folderService.checkFolderAccess(
      noteMeta.folderId,
      ctx.userId
    );

    if (!access.hasAccess) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'У вас нет доступа к папке, содержащей эту заметку',
      });
    }

    return next({
      ctx: {
        folderRole: access.role!,
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
      id: z.string().uuid(), // Здесь папка — главный объект, строго UUID
    })
  )
  .use(async ({ ctx, next, input }) => {
    // Никаких `??`, берем строго `id` папки
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
        folderAccessLevel: access.accessLevel!, // 'read' | 'write'
      },
    });
  });

// ==========================================
// 🛡️ 2. ГИБКАЯ ПРОЦЕДУРА ДЛЯ СВЯЗАННЫХ РЕСУРСОВ (ЗАМЕТКИ / ТЕГИ)
// ==========================================
export const rootOrFolderProcedure = protectedProcedure
  .input(
    z.object({
      folderId: z.string().uuid().nullable().optional(), // Может быть UUID, null или undefined
    })
  )
  .use(async ({ ctx, next, input }) => {
    const { folderId } = input;

    // 📥 Если folderId явно равен null или не передан — это строго Inbox!
    // Никакой хакер не сможет подменить контекст, потому что мы проверяем именно то поле,
    // которое отвечает за связь (внешний ключ).
    if (folderId === null || folderId === undefined) {
      return next({
        ctx: {
          targetFolderId: null,
          folderRole: 'owner' as const,
          folderAccessLevel: 'write' as const,
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
        folderRole: access.role!,
        folderAccessLevel: access.accessLevel!,
      },
    });
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
