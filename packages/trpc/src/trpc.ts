import { initTRPC, TRPCError } from '@trpc/server';
import z, { ZodError } from 'zod';
import { type Context } from './context.js';
import { NoteAccessInputSchema } from '@synapse-kms/shared';

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
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Для выполнения этого действия необходима авторизация',
    });
  }

  // Передаем user до UserContext
  return next({ ctx: { user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(isAuthed);

// НОВЫЙ ОДНОРОДНЫЙ ШЛЮЗ БЕЗОПАСНОСТИ ЗАМЕТОК
export const noteAccessProcedure = protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .use(async ({ ctx, next, input }) => {
    const access = await ctx.noteService.checkNoteAccess(input.id, ctx.user.id);

    // 1. Заметки нет (или удалена) — юнион говорит об этом явно
    if (!access.found) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Заметка не найдена в системе',
      });
    }

    // 2. Заметка есть, но доступа нет
    if (!access.hasAccess) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'У вас нет доступа к этой заметке или родительской папке',
      });
    }

    // 3. Доступ есть — прокидываем уровень дальше.
    // После проверок выше TypeScript сам сузил тип до { accessLevel: 'read' | 'write' | 'owner' }.
    return next({
      ctx: {
        noteAccessLevel: access.accessLevel,
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
      ctx.user.id
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
          // 🆕 Для Inbox владелец теперь полноценно имеет уровень 'owner'
          folderAccessLevel: 'owner' as const,
        },
      });
    }

    // 📁 Если folderId передан как UUID — жестко проверяем права в базе
    const access = await ctx.folderService.checkFolderAccess(
      folderId,
      ctx.user.id
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
      ctx.user.id
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

export const cachedNoteAccessProcedure = protectedProcedure
  .input(NoteAccessInputSchema)
  .use(async ({ ctx, input, next }) => {
    // TODO: Redis GET here (note:access:{userId}:{noteId})

    const access = await ctx.noteService.checkNoteAccess(
      input.noteId,
      ctx.user.id
    );

    if (!access.found) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Заметка не найдена в системе',
      });
    }

    if (!access.hasAccess) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'У вас нет доступа к этой заметке или родительской папке',
      });
    }

    // TODO: Redis SETEX here (TTL 300s), только для hasAccess: true

    return next({
      ctx: {
        ...ctx,
        noteAccessLevel: access.accessLevel,
      },
    });
  });
