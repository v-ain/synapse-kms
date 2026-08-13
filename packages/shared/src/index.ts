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

// Типы для тела запросов (Request Bodies)
export interface BulkMovePayload {
  items: { id: string; version: number }[];
  target_folder_id: string | null;
}

export interface AttachTagPayload {
  note_id: string;
  tag_name: string;
}

export interface CreateNotePayload {
  title: string;
  content: string;
  folder_id: string | null;
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
