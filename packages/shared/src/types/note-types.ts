import type { InferSelectModel } from 'drizzle-orm';
import type { notesTable } from '../schema/db-schema.js';

// 1. ВНУТРЕННИЙ ТИП БАЗЫ ДАННЫХ (Остается на бэкенде)
export type NoteRawDB = InferSelectModel<typeof notesTable>;

// 2. ПОДПИСЬ АВТОРА (Используется везде на фронте)
export type NoteAuthorInfo = {
  username: string; // Всегда есть (@cyber_architect)
  displayName: string | null; // Томас Андерсон (может быть пустым)
};

// 3. СТЕЙТ БЛОКИРОВКИ (Из Redis)
export type NoteLockInfo = {
  isLocked: boolean;
  lockedBy: string | null;
  lockedByName: string | null;
  expiresAt: number | null;
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
  clientUpdatedAt: string; // Зависит от того, сериализует ли tRPC даты
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
  content: any; // Твой JSON-объект редактора
  tags: string[];
  clientUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
  author: NoteAuthorInfo | null; // 🆕 Добавили автора!
  lock: NoteLockInfo;
};
