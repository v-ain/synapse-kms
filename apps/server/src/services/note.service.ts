import { eq, and, sql, desc, lt } from 'drizzle-orm';
import {
  notesTable,
  foldersTable,
  notesTagsTable,
  tagsTable,
  usersTable,
} from '@synapse-kms/shared';

import type {
  Note,
  CreateNotePayload,
  BulkMovePayload,
  PaginatedResponse,
  GetNotesQueryParams,
  NotePreview,
} from '@synapse-kms/shared';

import {
  PostgresJsDatabase,
  PostgresJsTransaction,
} from 'drizzle-orm/postgres-js';

const dbSchema = {
  usersTable,
  foldersTable,
  notesTable,
  tagsTable,
  notesTagsTable,
};

export class NoteService {
  // Внедряем типизированный инстанс 'db' вместо сырого 'sql'
  constructor(
    private db: PostgresJsDatabase<typeof dbSchema>,
    private log: any
  ) {}

  // 1. ПОЛУЧИТЬ КУРСОРНУЮ ПАГИНАЦИЮ ЗАМЕТОК (Highload O(1) с тегами)
  async getNotes(
    query: GetNotesQueryParams,
    userId: string
  ): Promise<PaginatedResponse<NotePreview>> {
    const { folder_id, filter = 'all', limit = '20', cursor } = query;

    const parsedLimit = Math.min(parseInt(limit, 10), 50);
    const sqlLimit = parsedLimit + 1; // Берем на 1 больше для проверки has_more

    // Собираем массив условий фильтрации
    const conditions = [
      eq(notesTable.is_archived, false),
      eq(notesTable.is_deleted, false),
      eq(notesTable.user_id, userId),
    ];

    // Фильтры папок
    if (filter === 'inbox') {
      conditions.push(sql`${notesTable.folder_id} IS NULL`);
    } else if (filter === 'folder' && folder_id) {
      conditions.push(eq(notesTable.folder_id, folder_id));
    }

    // Магия Курсора: если передан, берем записи строго старше таймстемпа курсора
    if (cursor) {
      conditions.push(lt(notesTable.updated_at, new Date(cursor)));
    }

    // Выполняем реляционный запрос через Drizzle с ручной агрегацией тегов
    const rawNotes = await this.db
      .select({
        id: notesTable.id,
        folder_id: notesTable.folder_id,
        title: notesTable.title,
        version: notesTable.version,
        is_archived: notesTable.is_archived,
        created_at: notesTable.created_at,
        updated_at: notesTable.updated_at,
        // Магия подрезки превью прямо в Postgres
        preview: sql<string>`substring(${notesTable.content} from 1 for 150)`,
        // Профессиональная склейка тегов в JSON-массив на уровне СУБД
        tags: sql<
          string[]
        >`COALESCE(json_agg(${tagsTable.name}) FILTER (WHERE ${tagsTable.name} IS NOT NULL), '[]'::json)`,
      })
      .from(notesTable)
      .leftJoin(notesTagsTable, eq(notesTable.id, notesTagsTable.note_id))
      .leftJoin(tagsTable, eq(notesTagsTable.tag_id, tagsTable.id))
      .where(and(...conditions))
      .groupBy(notesTable.id)
      .orderBy(desc(notesTable.updated_at))
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

  // 🔍 2. ПОЛУЧИТЬ КОНТЕНТ ЗАМЕТКИ ПО ID
  async getNoteById(id: string, userId: string): Promise<Note | null> {
    const [note] = await this.db
      .select()
      .from(notesTable)
      .where(
        and(
          eq(notesTable.id, id),
          eq(notesTable.user_id, userId),
          eq(notesTable.is_archived, false),
          eq(notesTable.is_deleted, false)
        )
      )
      .limit(1);

    return note || null;
  }

  // 🏗️ 3. СОЗДАТЬ ЗАМЕТКУ (С транзакционным пересчетом счетчика папки)
  async createNote(payload: CreateNotePayload, userId: string): Promise<Note> {
    const { title, content, folder_id } = payload;

    const newNote = await this.db.transaction(async (tx) => {
      // А. Вставляем саму заметку
      const [note] = await tx
        .insert(notesTable)
        .values({
          title: title.trim(),
          content: content || '',
          folder_id: folder_id || null,
          user_id: userId,
        })
        .returning();

      // Б. Атомарно пересчитываем notes_count папки через подзапрос
      if (folder_id) {
        await tx
          .update(foldersTable)
          .set({
            notes_count: sql`(SELECT COUNT(*) FROM ${notesTable} WHERE ${notesTable.folder_id} = ${foldersTable.id} AND ${notesTable.is_archived} = false AND ${notesTable.is_deleted} = false)`,
          })
          .where(eq(foldersTable.id, folder_id));
      }

      // Докидываем виртуальные поля для фронтенда, так как при создании тегов еще нет
      return {
        ...note,
        preview: (content || '').substring(0, 150),
        tags: [],
      };
    });

    return newNote;
  }

  // 🔄 4. BULK MOVE: МАССОВОЕ ПЕРЕМЕЩЕНИЕ С АТОМАРНЫМ ОПТИМИСТИЧНЫМ КОНТРОЛЕМ ВЕРСИЙ
  async bulkMove(
    payload: BulkMovePayload,
    userId: string
  ): Promise<{ success: boolean; conflict?: boolean }> {
    const { items, target_folder_id } = payload;
    const noteIds = items.map((i) => i.id);

    const result = await this.db.transaction(async (tx) => {
      // А. Собираем уникальные ID всех старых папок, откуда забираем заметки, чтобы потом обновить их счетчики
      const oldNotes = await tx
        .select({ folder_id: notesTable.folder_id })
        .from(notesTable)
        .where(
          and(
            sql`${notesTable.id} IN ${noteIds}`,
            eq(notesTable.user_id, userId)
          )
        );

      const uniqueOldFolderIds = Array.from(
        new Set(oldNotes.map((n) => n.folder_id).filter(Boolean))
      );

      // Б. Проверяем версии для предотвращения Race Condition (Оптимистичная блокировка)
      for (const item of items) {
        const [currentNote] = await tx
          .select({ version: notesTable.version })
          .from(notesTable)
          .where(
            and(eq(notesTable.id, item.id), eq(notesTable.user_id, userId))
          );

        if (!currentNote || currentNote.version !== item.version) {
          return { success: false, conflict: true }; // Версия не совпала — откат транзакции!
        }
      }

      // В. Выполняем массовое обновление папки назначения и инкрементируем версии
      for (const item of items) {
        await tx
          .update(notesTable)
          .set({
            folder_id: target_folder_id || null,
            version: sql`${notesTable.version} + 1`,
            updated_at: sql`CURRENT_TIMESTAMP`,
          })
          .where(
            and(eq(notesTable.id, item.id), eq(notesTable.user_id, userId))
          );
      }

      // Г. Атомарно пересчитываем счетчики во ВСЕХ затронутых старых папках
      if (uniqueOldFolderIds.length > 0) {
        for (const fId of uniqueOldFolderIds) {
          await tx
            .update(foldersTable)
            .set({
              notes_count: sql`(SELECT COUNT(*) FROM ${notesTable} WHERE ${notesTable.folder_id} = ${foldersTable.id} AND ${notesTable.is_archived} = false AND ${notesTable.is_deleted} = false)`,
            })
            .where(eq(foldersTable.id, fId as string));
        }
      }

      // Д. Атомарно пересчитываем счетчик для НОВОЙ папки
      if (target_folder_id) {
        await tx
          .update(foldersTable)
          .set({
            notes_count: sql`(SELECT COUNT(*) FROM ${notesTable} WHERE ${notesTable.folder_id} = ${foldersTable.id} AND ${notesTable.is_archived} = false AND ${notesTable.is_deleted} = false)`,
          })
          .where(eq(foldersTable.id, target_folder_id));
      }

      return { success: true };
    });

    return result;
  }

  // 5. АРХИВАЦИЯ ЗАМЕТКИ (Оптимизированная ACID логика без лишних SELECT)
  async archiveNote(
    id: string,
    userId: string
  ): Promise<
    { error: string; status: number } | { error: null; success: true }
  > {
    const result = await this.db.transaction(async (tx) => {
      // А. Сразу маркируем архив и возвращаем folder_id обновленной заметки
      const [updatedNote] = await tx
        .update(notesTable)
        .set({ is_archived: true, updated_at: sql`CURRENT_TIMESTAMP` })
        .where(and(eq(notesTable.id, id), eq(notesTable.user_id, userId)))
        .returning({ folder_id: notesTable.folder_id }); // Вытаскиваем только то, что нужно для счетчика

      // Если массив пустой, значит заметка не найдена или чужая
      if (!updatedNote) {
        return { error: 'Заметка не найдена или у вас нет прав', status: 404 };
      }

      // Б. Пересчитываем счетчик папки, в которой лежала заметка
      if (updatedNote.folder_id) {
        await tx
          .update(foldersTable)
          .set({
            notes_count: sql`(SELECT COUNT(*) FROM ${notesTable} WHERE ${notesTable.folder_id} = ${foldersTable.id} AND ${notesTable.is_archived} = false AND ${notesTable.is_deleted} = false)`,
          })
          .where(eq(foldersTable.id, updatedNote.folder_id));
      }

      return { error: null, success: true } as const;
    });

    return result;
  }

  // 🏷️ 6. ПРИВЯЗКА ТЕГА К ЗАМЕТКЕ (Many-to-Many ACID логика)
  async attachTag(
    noteId: string,
    tagName: string,
    userId: string
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Проверяем, существует ли тег, если нет — создаем атомарно
      let [tag] = await tx
        .select()
        .from(tagsTable)
        .where(eq(tagsTable.name, tagName))
        .limit(1);

      if (!tag) {
        [tag] = await tx
          .insert(tagsTable)
          .values({ name: tagName })
          .returning();
      }

      // Проверяем дубликат связи, чтобы не сломать уникальность
      const [linkExists] = await tx
        .select()
        .from(notesTagsTable)
        .where(
          and(
            eq(notesTagsTable.note_id, noteId),
            eq(notesTagsTable.tag_id, tag.id)
          )
        )
        .limit(1);

      if (!linkExists) {
        // Вставляем связь в Many-to-Many таблицу
        await tx
          .insert(notesTagsTable)
          .values({ note_id: noteId, tag_id: tag.id });

        // Инкрементируем версию заметки, так как ее метаданные изменились!
        await tx
          .update(notesTable)
          .set({
            version: sql`${notesTable.version} + 1`,
            updated_at: sql`CURRENT_TIMESTAMP`,
          })
          .where(
            and(eq(notesTable.id, noteId), eq(notesTable.user_id, userId))
          );
      }
    });
  }
}
