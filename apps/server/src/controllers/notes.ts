import type {
  Note,
  NotesFilter,
  BulkMovePayload,
  CreateNotePayload,
  GetNotesQueryParams,
  PaginatedResponse,
} from '@synapse-kms/shared';

export class NotesController {
  constructor(
    private sql: any,
    private log: any
  ) {}

  async getNotes(
    query: GetNotesQueryParams,
    userId: string
  ): Promise<PaginatedResponse<Note>> {
    const { folder_id, filter = 'all', limit = '20', cursor } = query;

    // Берем на 1 строку больше лимита, чтобы точно знать, есть ли данные дальше!
    const parsedLimit = Math.min(parseInt(limit, 10), 50);
    const sqlLimit = parsedLimit + 1;

    let conditions = this
      .sql`n.is_archived = FALSE AND n.is_deleted = FALSE AND n.user_id = ${userId}`;

    // 1. Фильтрация по папкам/входящим
    if (filter === 'inbox') {
      conditions = this.sql`${conditions} AND n.folder_id IS NULL`;
    } else if (filter === 'folder' && folder_id) {
      conditions = this.sql`${conditions} AND n.folder_id = ${folder_id}`;
    }

    // 2. Магия Курсора: Если курсор передан, берем только строки СТРОГО СТАРШЕ него
    if (cursor) {
      conditions = this.sql`${conditions} AND n.updated_at < ${cursor}`;
    }

    // Выполняем наш атомарный запрос
    const rawNotes = await this.sql<Note[]>`
    SELECT n.id, n.folder_id, n.title, n.version, n.is_archived, n.created_at, n.updated_at,
           substring(n.content from 1 for 150) as preview,
           COALESCE(json_agg(t.name) FILTER (WHERE t.name IS NOT NULL), '[]'::json) as tags
    FROM notes n
    LEFT JOIN notes_tags nt ON n.id = nt.note_id
    LEFT JOIN tags t ON nt.tag_id = t.id
    WHERE ${conditions}
    GROUP BY n.id 
    ORDER BY n.updated_at DESC -- Курсор завязан на этот порядок!
    LIMIT ${sqlLimit};
  `;

    // Проверяем, есть ли еще страницы
    const hasMore = rawNotes.length > parsedLimit;

    // Отрезаем лишнюю проверочную строку, если она есть
    const items = hasMore ? rawNotes.slice(0, parsedLimit) : rawNotes;

    // Формируем следующий курсор из поля updated_at последней заметки в массиве
    let nextCursor: string | null = null;
    if (items.length > 0) {
      const lastItem = items[items.length - 1];
      // Преобразуем дату в строгий ISO формат для передачи по сети
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

  // МЕТОД: Исправляем синтаксис UPDATE счетчика в backend/src/controllers/notes.ts
  async createNote(payload: CreateNotePayload, userId: string): Promise<Note> {
    const { title, content, folder_id } = payload;

    const [newNote] = await this.sql.begin(async (sql: any) => {
      // 1. Вставляем запись в таблицу notes
      const [note] = await sql<Note[]>`
      INSERT INTO notes (title, content, folder_id, user_id) -- Вшиваем user_id!
      VALUES (${title.trim()}, ${content || ''}, ${folder_id || null}, ${userId})
      RETURNING 
        id, 
        folder_id, 
        title, 
        version, 
        is_archived, 
        created_at, 
        updated_at,
        substring(content from 1 for 150) as preview,
        '[]'::json as tags;
    `;

      // 2. ⚡ ФИКС ТУТ: Обновляем счетчик папки БЕЗ сломанного алиаса "f"
      if (folder_id) {
        await sql`
        UPDATE folders
        SET notes_count = (
          SELECT COUNT(*) 
          FROM notes 
          WHERE folder_id = folders.id -- Используем полное имя таблицы 'folders' вместо алиаса 'f'!
            AND is_archived = FALSE 
            AND is_deleted = FALSE
            AND user_id = ${userId}
        )
        WHERE id = ${folder_id};
      `;
      }

      return [note];
    });

    return newNote;
  }

  async getNoteById(id: string, userId: string): Promise<Note | null> {
    const [note] = await this.sql<Note[]>`
      SELECT id, folder_id, title, content, version, is_archived, created_at, updated_at
      FROM notes WHERE id = ${id} AND is_archived = FALSE AND is_deleted = FALSE AND user_id = ${userId};
    `;
    return note || null;
  }

  async bulkMove(
    payload: BulkMovePayload,
    userId: string
  ): Promise<{ conflict: boolean }> {
    const { items, target_folder_id } = payload;
    const noteIds = items.map((i) => i.id);

    const conflictDetected = await this.sql.begin(async (sql: any) => {
      const sourceFolders =
        await sql`SELECT folder_id FROM notes WHERE id = ANY(${noteIds}) AND folder_id IS NOT NULL;`;

      const updated = await sql`
        UPDATE notes n SET folder_id = ${target_folder_id || null}, version = n.version + 1, updated_at = CURRENT_TIMESTAMP
        FROM (VALUES ${sql(items.map((i) => [i.id, i.version]))}) AS v(id, version)
        WHERE n.id = v.id::uuid AND n.version = v.version::integer  AND user_id = ${userId} RETURNING n.id;
      `;

      if (updated.length !== items.length) return true;

      if (sourceFolders.length > 0) {
        const uniqueIds = [
          ...new Set(sourceFolders.map((f: any) => f.folder_id)),
        ];
        await sql`
          UPDATE folders f
          SET notes_count = (SELECT COUNT(*) FROM notes WHERE folder_id = f.id AND is_archived = FALSE AND is_deleted = FALSE) WHERE f.id = ANY(${uniqueIds});`;
      }
      if (target_folder_id) {
        await sql`UPDATE folders f SET notes_count = (SELECT COUNT(*) FROM notes WHERE folder_id = f.id AND is_archived = FALSE AND is_deleted = FALSE) WHERE f.id = ${target_folder_id};`;
      }
      return false;
    });

    return { conflict: conflictDetected };
  }

  async archiveNote(id: string): Promise<{ status: number; error?: string }> {
    return this.sql.begin(async (sql: any) => {
      const [note] =
        await sql`SELECT folder_id, is_archived FROM notes WHERE id = ${id};`;
      if (!note) return { status: 404, error: 'Note not found' };
      if (note.is_archived)
        return { status: 400, error: 'Note is already archived' };

      await sql`UPDATE notes SET is_archived = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ${id};`;
      if (note.folder_id) {
        await sql`UPDATE folders f SET notes_count = (SELECT COUNT(*) FROM notes WHERE folder_id = f.id AND is_archived = FALSE AND is_deleted = FALSE) WHERE f.id = ${note.folder_id};`;
      }
      return { status: 200 };
    });
  }

  async attachTag(note_id: string, tag_name: string) {
    const cleanTagName = tag_name.trim().toLowerCase();
    await this.sql.begin(async (sql: any) => {
      const [tag] = await sql`
        INSERT INTO tags (name) VALUES (${cleanTagName})
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id;
      `;
      await sql`INSERT INTO notes_tags (note_id, tag_id) VALUES (${note_id}, ${tag.id}) ON CONFLICT DO NOTHING;`;
    });
    return { success: true };
  }
}
