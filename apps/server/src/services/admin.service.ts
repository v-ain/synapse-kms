import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, desc, lt, sql } from 'drizzle-orm';
import {
  notesTable,
  GetNotesQueryParams,
  PaginatedResponse,
  usersTable,
  NoteWithAuthor,
} from '@synapse-kms/shared';

export class AdminService {
  constructor(private db: PostgresJsDatabase<any>) {}

  // 1. ПОЛУЧИТЬ КУРСОРНУЮ ПАГИНАЦИЮ ЗАМЕТОК (Highload O(1) с тегами)
  async getNotes(
    query: GetNotesQueryParams,
    userId: string
  ): Promise<PaginatedResponse<NoteWithAuthor>> {
    const { folder_id, filter = 'all', limit = '20', cursor } = query;

    const parsedLimit = Math.min(parseInt(limit, 10), 50);
    const sqlLimit = parsedLimit + 1; // Берем на 1 больше для проверки has_more

    // Собираем массив условий фильтрации
    const conditions = [
      eq(notesTable.is_archived, false),
      eq(notesTable.is_deleted, false),
    ];

    // Магия Курсора: если передан, берем записи строго старше таймстемпа курсора
    if (cursor) {
      conditions.push(lt(notesTable.updated_at, new Date(cursor)));
    }

    // Выполняем реляционный запрос через Drizzle с ручной агрегацией тегов
    let rawNotes = await this.db
      .select({
        id: notesTable.id,
        title: notesTable.title,
        created_at: notesTable.created_at,
        updated_at: notesTable.updated_at,
        preview: sql<string>`substring(coalesce(${notesTable.content}, '') from 1 for 150)`,

        authorEmail: usersTable.email,
      })
      .from(notesTable)
      .leftJoin(usersTable, eq(notesTable.user_id, usersTable.id))
      .limit(sqlLimit);

    const hasMore = rawNotes.length > parsedLimit;
    const items = hasMore ? rawNotes.slice(0, parsedLimit) : rawNotes;

    let nextCursor: string | null = null;
    if (items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor =
        lastItem.updated_at instanceof Date
          ? lastItem.updated_at.toISOString()
          : String(lastItem.updated_at);
    }

    return {
      items,
      next_cursor: hasMore ? nextCursor : null,
      has_more: hasMore,
    };
  }
}
