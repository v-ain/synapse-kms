import {
  eq,
  and,
  sql,
  desc,
  lt,
  ilike,
  or,
  exists,
  inArray,
} from 'drizzle-orm';
import {
  notesTable,
  foldersTable,
  notesTagsTable,
  tagsTable,
} from '@synapse-kms/shared';

import type {
  Note,
  CreateNotePayload,
  BulkMovePayload,
  PaginatedResponse,
  GetNotesQueryParams,
  NotePreview,
  UpdateNotePayload,
} from '@synapse-kms/shared';

import { INoteService } from '@synapse-kms/trpc';
import { DrizzleDB } from 'src/db.js';

export class NoteService implements INoteService {
  // Внедряем типизированный инстанс 'db' вместо сырого 'sql'
  constructor(private db: DrizzleDB) {}

  // 1. ПОЛУЧИТЬ КУРСОРНУЮ ПАГИНАЦИЮ ЗАМЕТОК (Highload O(1) с тегами)
  async getNotes(
    query: GetNotesQueryParams,
    userId: string
  ): Promise<PaginatedResponse<NotePreview>> {
    const { folderId, filter = 'all', limit = '20', cursor } = query;

    const parsedLimit = Math.min(parseInt(limit, 10), 50);
    const sqlLimit = parsedLimit + 1; // Берем на 1 больше для проверки has_more

    // Собираем массив условий фильтрации
    const conditions = [
      eq(notesTable.isArchived, false),
      eq(notesTable.isDeleted, false),
      eq(notesTable.userId, userId),
    ];

    // Фильтры папок
    if (filter === 'inbox') {
      conditions.push(sql`${notesTable.folderId} IS NULL`);
    } else if (filter === 'folder' && folderId) {
      conditions.push(eq(notesTable.folderId, folderId));
    }

    // Фильтрация по тегу без разрушения json_agg
    if (filter === 'tag' && query.tagName) {
      conditions.push(
        // Проверяем существование связи Many-to-Many на уровне СУБД через EXISTS подзапрос
        exists(
          this.db
            .select()
            .from(notesTagsTable)
            .innerJoin(tagsTable, eq(notesTagsTable.tagId, tagsTable.id))
            .where(
              and(
                eq(notesTagsTable.noteId, notesTable.id), // связываем подзапрос с текущей строкой заметки
                eq(tagsTable.name, query.tagName) // ищем точное совпадение имени хэштега
              )
            )
        )
      );
    }

    // Магия Курсора: если передан, берем записи строго старше таймстемпа курсора
    if (cursor) {
      conditions.push(lt(notesTable.clientUpdatedAt, cursor));
    }

    const isSearchActive = query.search && query.search.trim().length > 0;
    const searchPattern = isSearchActive ? query.search!.trim() : '';

    if (isSearchActive) {
      const likePattern = `%${searchPattern}%`;
      conditions.push(
        or(
          ilike(notesTable.title, likePattern),
          // plainto_tsquery безопасно очищает пользовательский ввод от спецсимволов операторов СУБД
          sql`to_tsvector('russian', coalesce(${notesTable.title}, '') || ' ' || coalesce(${notesTable.content}, '')) @@ plainto_tsquery('russian', ${searchPattern})`
        )!
      );
    }

    // Выполняем реляционный запрос через Drizzle с ручной агрегацией тегов
    let rawNotes = await this.db
      .select({
        id: notesTable.id,
        folderId: notesTable.folderId,
        title: notesTable.title,
        clientUpdatedAt: notesTable.clientUpdatedAt,
        isArchived: notesTable.isArchived,
        createdAt: notesTable.createdAt,
        updatedAt: notesTable.updatedAt,
        preview: sql<string>`substring(coalesce(${notesTable.content}, '') from 1 for 150)`,
        // Профессиональная склейка тегов в JSON-массив на уровне СУБД
        tags: sql<
          string[]
        >`COALESCE(json_agg(${tagsTable.name}) FILTER (WHERE ${tagsTable.name} IS NOT NULL), '[]'::json)`,
      })
      .from(notesTable)
      .leftJoin(notesTagsTable, eq(notesTable.id, notesTagsTable.noteId))
      .leftJoin(tagsTable, eq(notesTagsTable.tagId, tagsTable.id))
      .where(and(...conditions))
      .groupBy(notesTable.id)
      .orderBy(desc(notesTable.clientUpdatedAt))
      .limit(sqlLimit);

    // 🎨 6. Фронтенд-подсветка найденного текста
    if (isSearchActive) {
      const escapedSearch = searchPattern.replace(
        /[-\/\\^\$*+?.()|[\]{}]/g,
        '\\$&'
      );
      const regex = new RegExp(`(${escapedSearch})`, 'gi');

      rawNotes = rawNotes.map((note) => ({
        ...note,
        preview: (note.preview || '').replace(
          regex,
          '<mark class="bg-amber-500/20 text-amber-300 px-0.5 rounded">\$1</mark>'
        ),
      }));
    }

    const hasMore = rawNotes.length > parsedLimit;
    const items = hasMore ? rawNotes.slice(0, parsedLimit) : rawNotes;

    let nextCursor: string | null = null;
    if (items.length > 0) {
      nextCursor = items[items.length - 1].clientUpdatedAt;
    }

    return {
      items,
      nextCursor: hasMore ? nextCursor : null,
      hasMore: hasMore,
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
          eq(notesTable.userId, userId),
          eq(notesTable.isArchived, false),
          eq(notesTable.isDeleted, false)
        )
      )
      .limit(1);

    if (!note) return null;

    return {
      ...note,
      preview: (note.content || '').substring(0, 150),
    };
  }

  // СОЗДАТЬ ЗАМЕТКУ (С транзакционным пересчетом счетчика папки)
  async createNote(payload: CreateNotePayload, userId: string): Promise<Note> {
    const { title, content, folderId } = payload;

    const newNote = await this.db.transaction(async (tx) => {
      // А. Вставляем саму заметку
      const [note] = await tx
        .insert(notesTable)
        .values({
          title: title.trim(),
          content: content || '',
          folderId: folderId || null,
          userId: userId,
        })
        .returning();

      // Б. Атомарно пересчитываем notes_count папки через подзапрос
      if (folderId) {
        await tx
          .update(foldersTable)
          .set({
            notesCount: sql`(SELECT COUNT(*) FROM ${notesTable} WHERE ${notesTable.folderId} = ${foldersTable.id} AND ${notesTable.isArchived} = false AND ${notesTable.isDeleted} = false)`,
          })
          .where(eq(foldersTable.id, folderId));
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

  async bulkMove(
    payload: BulkMovePayload,
    userId: string
  ): Promise<{ success: true; movedIds: string[] }> {
    const { items, targetFolderId } = payload;

    const movedIds: string[] = [];

    await this.db.transaction(async (tx) => {
      // А. Собираем ID всех папок, где сейчас лежат эти заметки (до перемещения)
      const noteIds = items.map((i) => i.id);
      const oldNotes = await tx
        .select({ folderId: notesTable.folderId })
        .from(notesTable)
        .where(
          and(inArray(notesTable.id, noteIds), eq(notesTable.userId, userId))
        );

      const uniqueOldFolderIds = Array.from(
        new Set(oldNotes.map((n) => n.folderId).filter(Boolean))
      ) as string[];

      // Б. Выполняем массовое обновление с LWW защитой для КАЖДОЙ заметки
      // Больше никаких SELECT для проверки версий — сразу бьем в UPDATE!
      for (const item of items) {
        const [updated] = await tx
          .update(notesTable)
          .set({
            folderId: targetFolderId || null,
            clientUpdatedAt: item.clientUpdatedAt,
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(notesTable.id, item.id),
              eq(notesTable.userId, userId),
              // Обновляем только если пришедший пакет новее того, что в базе
              lt(notesTable.clientUpdatedAt, item.clientUpdatedAt)
            )
          )
          .returning({ id: notesTable.id });

        if (updated) {
          movedIds.push(updated.id);
        }
      }

      // Если ни одна заметка не обновилась (все запросы устарели), счетчики менять не нужно
      if (movedIds.length === 0) return;

      // В. Собираем все папки, у которых нужно обновить счетчики (старые + новая)
      const foldersToUpdate = new Set([...uniqueOldFolderIds]);
      if (targetFolderId) {
        foldersToUpdate.add(targetFolderId);
      }

      // Г. Оптимизированный пересчет счетчиков: обновляем папки одним махом в цикле по затронутым ID
      if (foldersToUpdate.size > 0) {
        for (const fId of foldersToUpdate) {
          await tx
            .update(foldersTable)
            .set({
              notesCount: sql`(
              SELECT COUNT(*) 
              FROM ${notesTable} 
              WHERE ${notesTable.folderId} = ${foldersTable.id} 
                AND ${notesTable.isArchived} = false 
                AND ${notesTable.isDeleted} = false
            )`,
            })
            .where(eq(foldersTable.id, fId));
        }
      }
    });

    return { success: true, movedIds };
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
        .set({ isArchived: true, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(and(eq(notesTable.id, id), eq(notesTable.userId, userId)))
        .returning({ folderId: notesTable.folderId }); // Вытаскиваем только то, что нужно для счетчика

      // Если массив пустой, значит заметка не найдена или чужая
      if (!updatedNote) {
        return { error: 'Заметка не найдена или у вас нет прав', status: 404 };
      }

      // Б. Пересчитываем счетчик папки, в которой лежала заметка
      if (updatedNote.folderId) {
        await tx
          .update(foldersTable)
          .set({
            notesCount: sql`(SELECT COUNT(*) FROM ${notesTable} WHERE ${notesTable.folderId} = ${foldersTable.id} AND ${notesTable.isArchived} = false AND ${notesTable.isDeleted} = false)`,
          })
          .where(eq(foldersTable.id, updatedNote.folderId));
      }

      return { error: null, success: true } as const;
    });

    return result;
  }

  /**
   * Атомарное обновление заметки на основе семантики Last-Write-Wins (LWW).
   * Исключает race conditions на уровне HTTP без блокировки таблиц.
   */
  async updateNote(
    payload: UpdateNotePayload,
    userId: string
  ): Promise<Note | null> {
    const { id, clientUpdatedAt, title, content } = payload;

    // Собираем динамический объект полей для апдейта
    const updateFields: Record<string, any> = {
      clientUpdatedAt,
      updatedAt: new Date().toISOString(), // Серверный аудит
    };

    if (title !== undefined) updateFields.title = title.trim();
    if (content !== undefined) updateFields.content = content;

    // 1. Атомарный апдейт по времени изменения на клиенте
    const [updatedNote] = await this.db
      .update(notesTable)
      .set(updateFields)
      .where(
        and(
          eq(notesTable.id, id),
          eq(notesTable.userId, userId),
          // Защита: обновляем, только если в БД лежит более старый timestamp
          lt(notesTable.clientUpdatedAt, clientUpdatedAt)
        )
      )
      .returning();

    // 2. Если апдейт сработал — возвращаем обновленную заметку с preview
    if (updatedNote) {
      return {
        ...updatedNote,
        preview: (updatedNote.content || '').substring(0, 150),
      };
    }

    // 2. Фолбэк: если запрос устарел, берем то, что прямо сейчас лежит в базе
    const [currentNote] = await this.db
      .select()
      .from(notesTable)
      .where(and(eq(notesTable.id, id), eq(notesTable.userId, userId)))
      .limit(1);

    if (!currentNote) {
      return null;
    }

    return {
      ...currentNote,
      preview: (currentNote.content || '').substring(0, 150),
    };
  }
}
