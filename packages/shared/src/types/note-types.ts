import type { InferSelectModel } from 'drizzle-orm';
import type { notesTable } from '../schema/db-schema.js';
import z from 'zod';
import { NOTE_LIMITS } from '../constants.js';
import type { NoteLockInfo } from './system-events.types.js';

// 1. ВНУТРЕННИЙ ТИП БАЗЫ ДАННЫХ (Остается на бэкенде)
export type NoteRawDB = InferSelectModel<typeof notesTable>;

export type NoteCoreDTO = {
  id: string;
  // TODO: заменить null на строкоый тип 'inbox'
  folderId: string | null;
  title: string;
  preview: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  clientUpdatedAt: string;
};

export type CreateNoteResult = NoteCoreDTO;

// 2. ПОДПИСЬ АВТОРА (Используется везде на фронте)
export type NoteAuthorInfo = {
  username: string; // Всегда есть (@cyber_architect)
  displayName: string | null; // Томас Андерсон (может быть пустым)
};

// ==========================================
// ЧИСТЫЕ DTO ДЛЯ ТРАНСПОРТА И КЛИЕНТА
// ==========================================

// Для карточек в списке (Превьюшки заметок)
// Здесь нет тяжелого content, чтобы не забивать сеть
export type NotePreviewDTO = {
  id: string;
  folderId: string | null;
  title: string;
  preview: string;
  tags: string[];
  clientUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
  author: NoteAuthorInfo | null; // Добавили автора! null — если автор удален
  lock: NoteLockInfo;
};

// Для самого редактора (Полная заметка)
// Здесь появляется content, но уходит preview
export type NoteDTO = {
  id: string;
  folderId: string | null;
  title: string;
  content: string;
  tags: string[];
  clientUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
  author: NoteAuthorInfo | null;
  lock: NoteLockInfo;
};

// СХЕМЫ ВАЛИДАЦИИ ZOD (Enterprise-слой)
// Схема создания заметки
export const CreateNoteSchema = z.object({
  title: z
    .string()
    .min(NOTE_LIMITS.TITLE_MIN, 'TITLE_EMPTY')
    .max(NOTE_LIMITS.TITLE_MAX, 'TITLE_TOO_LONG')
    .transform((val) => val.trim()),
  content: z
    .string()
    .max(NOTE_LIMITS.CONTENT_MAX, 'CONTENT_TOO_LONG')
    .default(''),
  folderId: z.string().uuid().nullable(),
});

export const AutoSaveNoteContentSchema = z.object({
  noteId: z.string().uuid(),
  content: z.string().max(NOTE_LIMITS.CONTENT_MAX, 'CONTENT_TOO_LONG'),
  clientUpdatedAt: z.string().datetime({ offset: true }),
});

export const UpdateNoteMetaSchema = z.object({
  noteId: z.string().uuid(),
  title: z
    .string()
    .min(NOTE_LIMITS.TITLE_MIN, 'TITLE_EMPTY')
    .max(NOTE_LIMITS.TITLE_MAX, 'TITLE_TOO_LONG')
    .transform((val) => val.trim())
    .refine((val) => val.length >= NOTE_LIMITS.TITLE_MIN, {
      message: 'TITLE_EMPTY',
    }),
  clientUpdatedAt: z.string().datetime({ offset: true }),
});

export type CreateNotePayload = z.infer<typeof CreateNoteSchema>;
export type AutoSaveNotePayload = z.infer<typeof AutoSaveNoteContentSchema>;
export type UpdateNoteMetaPayload = z.infer<typeof UpdateNoteMetaSchema>;

export const NoteAccessInputSchema = z.object({
  noteId: z.string().uuid(),
});

export type CheckNoteAccessResult =
  | { found: false }
  | { found: true; hasAccess: false }
  | { found: true; hasAccess: true; accessLevel: 'read' | 'write' | 'owner' };

/**
 * Результат любой write-операции над заметкой (updateMeta, autoSaveContent).
 * Не содержит DTO — read-side собирает его в get/list.
 */
export type NoteWriteResult =
  | { status: 'applied' }
  | { status: 'stale' }
  | { status: 'gone' }
  | { status: 'locked'; lockedBy: string | null; lockedByName: string | null };
