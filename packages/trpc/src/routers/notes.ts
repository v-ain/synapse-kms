import {
  router,
  protectedProcedure,
  rootOrFolderProcedure,
  noteAccessProcedure,
  targetFolderAccessProcedure,
} from '../trpc.js';
import { z } from 'zod';

// Импортируем Zod-схему, которую вы создали ранее в shared
import {
  BulkMovePayloadSchema,
  CreateNoteSchema,
  getNotesQueryParamsSchema,
  UpdateNotePayloadSchema,
} from '@synapse-kms/shared';
import { TRPCError } from '@trpc/server';

export const notesRouter = router({
  getNotes: protectedProcedure
    // Передаем Zod-схему. Она проверит folder_id, limit, cursor и т.д.
    .input(getNotesQueryParamsSchema)
    .query(async ({ input, ctx }) => {
      // Никаких 'if (!ctx.userId)'! TypeScript знает, что ctx.userId здесь железобетонно string!
      return await ctx.noteService.getNotes(input, ctx.userId);
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
        ctx.userId
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
      // 1. Проверяем права на запись (кастим к string, чтобы TS в не ругался)
      const accessLevel = ctx.folderAccessLevel as string;
      const canWrite = accessLevel === 'write' || accessLevel === 'owner';

      if (!canWrite) {
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
      return await ctx.noteService.bulkMove(input, ctx.userId);
    }),

  // Атомарное обновление контента с проверкой версии
  update: noteAccessProcedure // ОХРАНА: Проверяет существование заметки и доступ к папке
    .input(UpdateNotePayloadSchema)
    .mutation(async ({ input, ctx }) => {
      // 1. ИСПРАВЛЕНИЕ ACL: Разрешаем запись и редакторам ('write'), и владельцам ('owner')
      const accessLevel = ctx.folderAccessLevel as string;
      const canWrite = accessLevel === 'write' || accessLevel === 'owner';

      if (!canWrite) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'У вас есть права только на чтение заметок в этой папке',
        });
      }

      // 2. Передаем инпут в сервис (без userId, доверяя мидлвару)
      const result = await ctx.noteService.updateNote(input, ctx.userId);

      if (!result.note) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Заметка не найдена в базе данных',
        });
      }

      // 3. ⚠️ ОБРАБОТКА КОНФЛИКТА СИНХРОНИЗАЦИИ (Честный LWW)
      if (result.isRejected) {
        throw new TRPCError({
          code: 'CONFLICT', // Отдаем статус 409
          message:
            'Изменения отклонены. В базе данных уже есть более свежая версия документа.',
          // Прокидываем актуальную версию заметки, чтобы клиент мог перетереть свой локальный кэш
          cause: result.note,
        });
      }

      return result.note;
    }),
});
