import {
  router,
  protectedProcedure,
  rootOrFolderProcedure,
  noteAccessProcedure,
  targetFolderAccessProcedure,
  cachedNoteAccessProcedure,
} from '../trpc.js';

import {
  AutoSaveNoteContentSchema,
  BulkMovePayloadSchema,
  CreateNoteSchema,
  getNotesQueryParamsSchema,
  type NoteWriteResult,
  UpdateNoteMetaSchema,
} from '@synapse-kms/shared';
import { TRPCError } from '@trpc/server';

export const notesRouter = router({
  getNotes: protectedProcedure
    // Передаем Zod-схему. Она проверит folder_id, limit, cursor и т.д.
    .input(getNotesQueryParamsSchema)
    .query(async ({ input, ctx }) => {
      return await ctx.noteService.getNotes(input, ctx.user.id);
    }),

  create: rootOrFolderProcedure
    .input(CreateNoteSchema) // Склеиваем схемы. На входе будет полный контракт заметки
    .mutation(async ({ input, ctx }) => {
      // 1. ИСПРАВЛЕНИЕ: Разрешаем запись и редакторам ('write'), и владельцам ('owner')
      const canWrite =
        ctx.folderAccessLevel === 'write' || ctx.folderAccessLevel === 'owner';

      if (!canWrite) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'У вас нет прав на создание заметок в этой директории',
        });
      }

      // 2. Вызываем сервис заметок. Данные о папке берем строго из контекста безопасности!
      const newNote = await ctx.noteService.createNote(
        {
          ...input,
          folderId: ctx.targetFolderId, // Передаем проверенный UUID или null (для Inbox)
        },
        ctx.user.id
      );

      return newNote;
    }),

  // Роутер получения одной заметки по ID
  getById: noteAccessProcedure // Охрана на входе отработала за 0.2мс!
    .query(async ({ input, ctx }) => {
      const note = await ctx.noteService.getNoteById(input.id);

      if (!note) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Заметка не найдена в базе данных',
        });
      }

      return note;
    }),

  archive: noteAccessProcedure // Охрана на входе проверяет доступы за 0.2мс
    .mutation(async ({ input, ctx }) => {
      if (ctx.noteAccessLevel === 'read') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'У вас нет прав на архивацию этой заметки',
        });
      }

      // 2. Вызываем очищенный сервис! Больше никакого ctx.userId внутрь не передаем
      const result = await ctx.noteService.archiveNote(input.id);

      if (result.error) {
        throw new TRPCError({
          code: result.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
          message: result.error,
        });
      }

      return { success: true };
    }),

  // Пакетное перемещение заметок с атомарным разрешением гонок (LWW)
  bulkMove: targetFolderAccessProcedure // Защищаем новым специализированным шлюзом
    .input(BulkMovePayloadSchema) // Схема содержит targetFolderId, и типы идеально сходятся!
    .mutation(async ({ input, ctx }) => {
      const targetAccess = ctx.targetFolderAccessLevel as string;
      const canWrite = targetAccess === 'write' || targetAccess === 'owner';

      if (!canWrite) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Доступ к целевой папке только на чтение',
        });
      }

      // Вызываем сервис
      return await ctx.noteService.bulkMove(input, ctx.user.id);
    }),

  autoSaveContent: cachedNoteAccessProcedure
    .input(AutoSaveNoteContentSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.noteAccessLevel === 'read') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'У вас есть права только на чтение заметок в этой папке',
        });
      }

      const result = await ctx.noteService.autoSaveContent(input, ctx.user.id);
      return handleWriteResult(result); // общий хелпер
    }),

  updateMeta: cachedNoteAccessProcedure
    .input(UpdateNoteMetaSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.noteAccessLevel === 'read') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'У вас есть права только на чтение заметок в этой папке',
        });
      }

      const result = await ctx.noteService.updateMeta(input, ctx.user.id);
      return handleWriteResult(result);
    }),
});

function handleWriteResult(result: NoteWriteResult): {
  status: 'applied' | 'stale';
} {
  switch (result.status) {
    case 'applied':
    case 'stale':
      // Оба — 200 OK. stale отличается только семантикой для тоста/метрик.
      return { status: result.status };

    case 'gone':
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Заметка не найдена' });

    case 'locked':
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Заметка заблокирована другим пользователем',
        cause: { lockedBy: result.lockedBy, lockedByName: result.lockedByName },
      });

    default: {
      const _exhaustive: never = result;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Unknown status',
      });
    }
  }
}
