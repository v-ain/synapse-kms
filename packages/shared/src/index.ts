import { z } from 'zod';
export type NotesFilter = 'all' | 'inbox' | 'folder';

export interface Folder {
  id: string;
  title: string;
  notes_count: number;
  created_at: string | Date;
}

export interface Note {
  id: string;
  folder_id: string | null;
  title: string;
  content?: string;
  preview?: string;
  version: number;
  is_archived: boolean;
  created_at: string | Date;
  updated_at: string | Date;
  tags: string[]; // Агрегированный массив тегов
}

export interface Tag {
  id: string;
  name: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  next_cursor: string | null; // Передаем таймстемп последней заметки в формате ISO строки
  has_more: boolean;
}

// Обновим тип параметров запроса списков
export interface GetNotesQueryParams {
  folder_id?: string;
  filter?: 'all' | 'inbox' | 'folder';
  limit?: string;
  cursor?: string; // Наш новый входящий курсор (updated_at)
}

// СХЕМЫ ВАЛИДАЦИИ ZOD (Enterprise-слой)

// Схема создания заметки
export const CreateNoteSchema = z.object({
  title: z
    .string()
    .min(1, { message: 'Заголовок не может быть пустым' })
    .max(100, { message: 'Заголовок слишком длинный (макс. 100 симв.)' })
    .transform((val) => val.trim()), // Автоматически делает .trim() на лету!

  content: z.string().default(''),

  folder_id: z
    .string()
    .uuid({ message: 'Некорректный формат UUID папки' })
    .nullable(),
});

// Схема пакетного перемещения заметок
export const BulkMoveSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        version: z.number().int().positive(),
      })
    )
    .min(1, { message: 'Массив заметок не должен быть пустым' }),

  target_folder_id: z.string().uuid().nullable(),
});

// 🧬 3. АВТОГЕНЕРАЦИЯ ТИПОВ ИЗ СХЕМ ДЛЯ TYPESCRIPT
// Больше никакого дублирования! TS-типы строятся прямо по схемам валидации!
export type CreateNotePayload = z.infer<typeof CreateNoteSchema>;
export type BulkMovePayload = z.infer<typeof BulkMoveSchema>;

// Тип параметров для пагинации списков
export interface GetNotesQueryParams {
  folder_id?: string;
  filter?: NotesFilter;
  limit?: string;
  cursor?: string;
}
