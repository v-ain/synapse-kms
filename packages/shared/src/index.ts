import { z } from 'zod';
import type { InferSelectModel } from 'drizzle-orm';
import { foldersTable, notesTable } from './db-schema.js';

export type Folder = InferSelectModel<typeof foldersTable>;
export type Note = InferSelectModel<typeof notesTable> & {
  preview?: string;
  tags?: string[];
};

export type NotePreview = Omit<Note, 'content' | 'is_deleted' | 'user_id'> & {
  preview: string;
  tags: string[];
};

// Экспортируем саму схему для бэкенда
export * from './db-schema.js';

export type NotesFilter = 'all' | 'inbox' | 'folder';

export interface Tag {
  id: string;
  name: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  next_cursor: string | null; // Передаем таймстемп последней заметки в формате ISO строки
  has_more: boolean;
}

// СХЕМЫ ВАЛИДАЦИИ ZOD (Enterprise-слой)

// Схема создания заметки
export const CreateNoteSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(100)
    .transform((val) => val.trim()),
  content: z.string().default(''),
  folder_id: z.string().uuid().nullable(),
});

// Схема пакетного перемещения заметок
export const BulkMoveSchema = z.object({
  items: z
    .array(z.object({ id: z.string().uuid(), version: z.number().int() }))
    .min(1),
  target_folder_id: z.string().uuid().nullable(),
});

// TS-типы строятся по схемам валидации!
export type CreateNotePayload = z.infer<typeof CreateNoteSchema>;
export type BulkMovePayload = z.infer<typeof BulkMoveSchema>;

// Тип параметров для пагинации списков
export interface GetNotesQueryParams {
  folder_id?: string;
  filter?: NotesFilter;
  limit?: string;
  cursor?: string;
}
