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
  folderSharesTable,
} from '@synapse-kms/shared';

import type {
  Note,
  CreateNotePayload,
  BulkMovePayload,
  PaginatedResponse,
  GetNotesQueryParams,
  NotePreview,
  UpdateNotePayload,
  NoteWithTags,
} from '@synapse-kms/shared';

import { INoteService } from '@synapse-kms/trpc';
import { DrizzleDB } from 'src/db.js';

export class NoteService implements INoteService {
  // Внедряем типизированный инстанс 'db' вместо сырого 'sql'
  constructor(private db: DrizzleDB) {}

  // Получить только метаданные для проверки безопасности
  async getNoteMeta(
    id: string
  ): Promise<{ userId: string; folderId: string | null } | null> {
    const meta = await this.db.query.notesTable.findFirst({
      where: (notes, { and, eq }) =>
        and(eq(notes.id, id), eq(notes.isDeleted, false)),
      columns: {
        userId: true,
        folderId: true,
      },
    });

    return meta || null;
  }
  // 1. ПОЛУЧИТЬ КУРСОРНУЮ ПАГИНАЦИЮ ЗАМЕТОК (Highload O(1) с тегами)
  async getNotes(
    query: GetNotesQueryParams,
    userId: string
  ): Promise<PaginatedResponse<NotePreview>> {
    const { folderId, filter = 'all', limit = '20', cursor } = query;

    const parsedLimit = Math.min(parseInt(limit, 10), 50);
    const sqlLimit = parsedLimit + 1; // Берем на 1 больше для проверки has_more

    // Базовые условия (удаленные/архивные и привязка к юзеру для личных заметок)
    // ВНИМАНИЕ: Если фильтр 'folder', то условие eq(notesTable.userId, userId)
    // нужно будет сделать гибким, так как в чужой папке заметки принадлежат ЧУЖОМУ юзеру!
    const conditions = [
      eq(notesTable.isArchived, false),
      eq(notesTable.isDeleted, false),
    ];

    // Если мы НЕ запрашиваем конкретную расшаренную папку,
    // показываем строго личные заметки пользователя
    if (filter !== 'folder') {
      conditions.push(eq(notesTable.userId, userId));
    }

    // Фильтры папок с учетом прав доступа
    if (filter === 'inbox') {
      conditions.push(sql`${notesTable.folderId} IS NULL`);
      conditions.push(eq(notesTable.userId, userId)); // Inbox всегда строго личный
    } else if (filter === 'folder' && folderId) {
      conditions.push(eq(notesTable.folderId, folderId));

      // Магия: Либо ты владелец заметки, либо у тебя есть запись в folder_shares для этой папки
      conditions.push(
        or(
          eq(notesTable.userId, userId), // Вариант А: Моя личная папка
          exists(
            this.db
              .select()
              .from(folderSharesTable)
              .where(
                and(
                  eq(folderSharesTable.folderId, folderId),
                  eq(folderSharesTable.userId, userId) // Бьем точно по составному индексу!
                )
              )
          )
        )!
      );
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
    // if (isSearchActive) {
    //   const escapedSearch = searchPattern.replace(
    //     /[-\/\\^\$*+?.()|[\]{}]/g,
    //     '\\$&'
    //   );
    //   const regex = new RegExp(`(${escapedSearch})`, 'gi');
    //
    //   rawNotes = rawNotes.map((note) => ({
    //     ...note,
    //     preview: (note.preview || '').replace(
    //       regex,
    //       '<mark class="bg-amber-500/20 text-amber-300 px-0.5 rounded">\$1</mark>'
    //     ),
    //   }));
    // }

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

  // 2. ПОЛУЧИТЬ КОНТЕНТ ЗАМЕТКИ ПО ID (Права проверены на уровне API слоя)
  async getNoteById(id: string): Promise<NoteWithTags | null> {
    const noteData = await this.db.query.notesTable.findFirst({
      where: (notes, { and, eq }) =>
        and(
          eq(notes.id, id),
          eq(notes.isDeleted, false) // 🚀 Убрали жесткий фильтр по userId!
        ),
      with: {
        notes_tags: {
          with: {
            tag: true,
          },
        },
      },
    });

    if (!noteData) return null;

    const tags = noteData.notes_tags.map((nt) => nt.tag.name);

    return {
      id: noteData.id,
      folderId: noteData.folderId,
      title: noteData.title,
      content: noteData.content,
      isArchived: noteData.isArchived,
      isDeleted: noteData.isDeleted,
      userId: noteData.userId,
      clientUpdatedAt: noteData.clientUpdatedAt,
      createdAt: noteData.createdAt,
      updatedAt: noteData.updatedAt,
      tags: tags,
      preview: (noteData.content || '').substring(0, 150),
    };
  }

  // СОЗДАТЬ ЗАМЕТКУ
  async createNote(payload: CreateNotePayload, userId: string): Promise<Note> {
    const { title, content, folderId } = payload;

    // 🚀 АТОМАРНАЯ ВСТАВКА: Больше никаких транзакций и блокировок папок!
    const [note] = await this.db
      .insert(notesTable)
      .values({
        title: title.trim(),
        content: content || '',
        folderId: folderId || null, // null означает Inbox
        userId: userId,
      })
      .returning();

    // Возвращаем объект, обогащая его виртуальными полями для фронтенда
    return {
      ...note,
      preview: (content || '').substring(0, 150),
      tags: [], // При создании заметки тегов на ней еще нет
    };
  }

  async bulkMove(
    payload: BulkMovePayload,
    userId: string
  ): Promise<{ success: true; movedIds: string[] }> {
    const { items, targetFolderId } = payload;
    const movedIds: string[] = [];

    // БОЛЬШЕ НИКАКИХ ТРАНЗАКЦИЙ, СЕЛЕКТОВ СТАРЫХ ПАПОК И ЦИКЛОВ ОБНОВЛЕНИЯ СЧЕТЧИКОВ!
    // Массовое обновление с Lock-Free LWW-защитой для каждой заметки.
    for (const item of items) {
      const [updated] = await this.db
        .update(notesTable)
        .set({
          folderId: targetFolderId || null, // null означает Inbox
          clientUpdatedAt: item.clientUpdatedAt,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(notesTable.id, item.id),
            eq(notesTable.userId, userId),
            // Атомарный фильтр времени LWW: пишем, только если пришедший пакет новее версии в СУБД
            lt(notesTable.clientUpdatedAt, item.clientUpdatedAt)
          )
        )
        .returning({ id: notesTable.id });

      if (updated) {
        movedIds.push(updated.id);
      }
    }

    // Возвращаем фронтенду массив ID заметок, которые реально сменили локацию
    return { success: true, movedIds };
  }

  // 5. АРХИВАЦИЯ ЗАМЕТКИ (Чистая атомарная логика без транзакций и пересчетов)
  async archiveNote(
    id: string,
    userId: string
  ): Promise<
    { error: string; status: number } | { error: null; success: true }
  > {
    // 🚀 ОДИН АТОМАРНЫЙ ЗАПРОС: Сразу маркируем архив и проверяем автора
    const [updatedNote] = await this.db
      .update(notesTable)
      .set({
        isArchived: true,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          eq(notesTable.id, id),
          eq(notesTable.userId, userId) // Защита: архивировать может только создатель
        )
      )
      .returning(); // Нам больше не нужно вытаскивать folderId для счетчиков!

    // Если база вернула пустой массив, значит заметка не существует или она чужая
    if (!updatedNote) {
      return { error: 'Заметка не найдена или у вас нет прав', status: 404 };
    }

    return { error: null, success: true };
  }

  /**
   * Атомарное обновление заметки на основе семантики Last-Write-Wins (LWW).
   * Права доступа гарантированы вызывающим слоем API.
   */
  async updateNote(payload: UpdateNotePayload): Promise<{
    success: boolean;
    isRejected: boolean;
    note: NoteWithTags | null;
  }> {
    const { id, clientUpdatedAt, title, content } = payload;

    const updateFields: Record<string, any> = {
      clientUpdatedAt,
      updatedAt: new Date().toISOString(),
    };

    if (title !== undefined) updateFields.title = title.trim();
    if (content !== undefined) updateFields.content = content;

    // 1. Атомарный апдейт с проверкой MVCC-версии
    const [updatedNote] = await this.db
      .update(notesTable)
      .set(updateFields)
      .where(
        and(
          eq(notesTable.id, id),
          // Запись разрешена, только если входящий таймстемп строго новее, чем в СУБД
          lt(notesTable.clientUpdatedAt, clientUpdatedAt)
        )
      )
      .returning();

    // 2. В ЛЮБОМ СЛУЧАЕ забираем текущие актуальные данные с тегами для синхронизации клиента
    const noteData = await this.db.query.notesTable.findFirst({
      where: (notes, { eq }) => eq(notes.id, id),
      with: {
        notes_tags: {
          with: { tag: true },
        },
      },
    });

    if (!noteData) {
      return { success: false, isRejected: false, note: null };
    }

    // Схлопываем теги
    const tags = noteData.notes_tags.map((nt) => nt.tag.name);
    const mappedNote: NoteWithTags = {
      id: noteData.id,
      folderId: noteData.folderId,
      title: noteData.title,
      content: noteData.content,
      isArchived: noteData.isArchived,
      isDeleted: noteData.isDeleted,
      userId: noteData.userId,
      clientUpdatedAt: noteData.clientUpdatedAt,
      createdAt: noteData.createdAt,
      updatedAt: noteData.updatedAt,
      tags: tags,
      preview: (noteData.content || '').substring(0, 150),
    };

    // ОПРЕДЕЛЯЕМ ИСТИННЫЙ РЕЗУЛЬТАТ LWW
    // Если апдейт вернул пустой массив, но в базе заметка есть — значит, пришел устаревший пакет!
    if (!updatedNote) {
      return { success: false, isRejected: true, note: mappedNote };
    }

    return { success: true, isRejected: false, note: mappedNote };
  }
}
