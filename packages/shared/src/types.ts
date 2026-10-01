import { z } from 'zod';
import type { InferSelectModel } from 'drizzle-orm';
import { foldersTable, notesTable, tagsTable } from './db-schema.js';
import { NOTE_LIMITS } from './constants.js';

export type Note = InferSelectModel<typeof notesTable> & {
  preview?: string;
  tags?: string[];
};

// Превью тоже автоматически использует string для дат
export type NotePreview = Omit<
  Note,
  'content' | 'isDeleted' | 'userId' | 'preview' | 'tags'
> & {
  preview: string;
  tags: string[];
};

export type NoteWithAuthor = Pick<
  Note,
  'id' | 'title' | 'created_at' | 'updated_at' | 'preview'
> & { authorEmail: string };

// export type NotesFilter = 'all' | 'inbox' | 'folder';

export type Folder = InferSelectModel<typeof foldersTable>;

// Схема для создания папки
export const CreateFolderSchema = z.object({
  title: z
    .string()
    .min(1, { message: 'Название папки не может быть пустым' })
    .max(50, { message: 'Название папки не должно превышать 50 символов' })
    .transform((val) => val.trim()),
});

// Схема для удаления папки
export const DeleteFolderSchema = z.object({
  id: z.string().uuid({ message: 'Некорректный формат ID папки' }),
  clientUpdatedAt: z.string().datetime({ offset: true }),
});

// Экспортируем типы инференса для использования в контрактах сервисов
export type CreateFolderInput = z.infer<typeof CreateFolderSchema>;
export type DeleteFolderPayload = z.infer<typeof DeleteFolderSchema>;

// ==========================================
// ДОМЕННЫЕ ТИПЫ (Авто-вывод из базы данных)
// ==========================================

export type Tag = InferSelectModel<typeof tagsTable>;

// Создаем расширенный UI/DTO тип: берем все поля Tag и подмешиваем notes_count
export interface TagWithCount extends Tag {
  notesCount: number;
}

// ==========================================
// СХЕМЫ ВАЛИДАЦИИ И PAYLOADS (Zod)
// ==========================================

// Схема для валидации входных данных при привязке тега
export const AttachTagSchema = z.object({
  noteId: z.string().uuid({ message: 'Некорректный формат ID заметки' }),
  tagName: z
    .string()
    .min(1, { message: 'Тег не может быть пустым' })
    .max(30, { message: 'Тег слишком длинный (макс. 30 символов)' })
    // Смарт-нормализация прямо на входе в систему!
    .transform((val) => val.trim().toLowerCase()),
});

// Автоматически выводим тип Payload для аргументов сервиса из Zod-схемы!
// Получится чистый тип: { noteId: string; tagName: string }
export type AttachTagPayload = z.infer<typeof AttachTagSchema>;

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null; // Передаем таймстемп последней заметки в формате ISO строки
  hasMore: boolean;
}

// СХЕМЫ ВАЛИДАЦИИ ZOD (Enterprise-слой)
// packages/shared/src/schemas/notes.ts
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

// Zod-схемы для апдейта заметки
export const UpdateNotePayloadSchema = z.object({
  id: z.string().uuid(),
  // Заменяем version на обязательную ISO-строку даты изменения
  clientUpdatedAt: z.string().datetime({ offset: true }),
  title: z
    .string()
    .min(NOTE_LIMITS.TITLE_MIN, 'TITLE_EMPTY')
    .max(NOTE_LIMITS.TITLE_MAX, 'TITLE_TOO_LONG')
    .optional(),
  content: z
    .string()
    .max(NOTE_LIMITS.CONTENT_MAX, 'CONTENT_TOO_LONG')
    .optional(),
});

// Тип автоматически выведется правильно:
export type UpdateNotePayload = z.infer<typeof UpdateNotePayloadSchema>;

// Схема пакетного перемещения заметок
export const BulkMovePayloadSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        clientUpdatedAt: z.string().datetime({ offset: true }),
      })
    )
    .min(1),
  targetFolderId: z.string().uuid().nullable(),
});

// TS-типы строятся по схемам валидации!
export type CreateNotePayload = z.infer<typeof CreateNoteSchema>;
export type BulkMovePayload = z.infer<typeof BulkMovePayloadSchema>;

// Описываем допустимые значения для фильтра
export const notesFilterSchema = z.enum([
  'all',
  'inbox',
  'archive',
  'folder',
  'tag',
]);
export type NotesFilter = z.infer<typeof notesFilterSchema>;

// 🛡️ Живая Zod-схема для валидации параметров запроса
export const getNotesQueryParamsSchema = z.object({
  folderId: z.string().uuid().optional(),
  filter: notesFilterSchema.optional(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
  search: z.string().optional(),
  tagName: z.string().optional(),
  // cursor: z.string().nullish(), // Обязательно nullish или optional!
});

// Автоматически вытаскиваем TS-тип из схемы (он заменит твой старый interface!)
export type GetNotesQueryParams = z.infer<typeof getNotesQueryParamsSchema>;

// Схема авторизации / регистрации
export const authCredentialsSchema = z.object({
  email: z.string().email({ message: 'Некорректный формат email' }),
  password: z
    .string()
    .min(6, { message: 'Пароль должен быть не менее 6 символов' }),
});

export type AuthCredentials = z.infer<typeof authCredentialsSchema>;
