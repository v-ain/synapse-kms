import { eq, and, sql, desc, lt, ilike, or, exists } from 'drizzle-orm';
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
      conditions.push(lt(notesTable.updatedAt, cursor));
    }

    // if (query.search && query.search.trim().length > 0) {
    //   const searchPattern = query.search.trim();
    //
    //   const searchFilter = or(
    //     // 1. Поиск по подстроке в заголовке
    //     ilike(notesTable.title, `%${searchPattern}%`),
    //     // 2. Полнотекстовый поиск по контенту заметки
    //     sql`to_tsvector('russian', ${notesTable.content}) @@ to_tsquery('russian', ${searchPattern.replace(/\s+/g, ' & ')})`
    //   );
    //
    //   // 🪄 Проверяем, что Drizzle успешно собрал SQL-фрагмент
    //   if (searchFilter) {
    //     conditions.push(searchFilter);
    //   }
    // }

    const isSearchActive = query.search && query.search.trim().length > 0;
    const searchPattern = isSearchActive ? query.search!.trim() : '';

    if (isSearchActive) {
      // Формируем паттерн для ILIKE (поиск по подстроке)
      const likePattern = `%${searchPattern}%`;

      conditions.push(
        or(
          ilike(notesTable.title, likePattern),
          ilike(notesTable.content, likePattern), // 🛡️ Дублируем быстрый ILIKE на контент, если полнотекст промахнётся
          // Полнотекстовый поиск с префиксами (чтобы искало по мере ввода: "баз" найдет "база")
          sql`to_tsvector('russian', coalesce(${notesTable.content}, '')) @@ to_tsquery('russian', ${searchPattern.replace(/\s+/g, ' & ') + ':*'})`
        )!
      );
    }

    // Выполняем реляционный запрос через Drizzle с ручной агрегацией тегов
    let rawNotes = await this.db
      .select({
        id: notesTable.id,
        folderId: notesTable.folderId,
        title: notesTable.title,
        version: notesTable.version,
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
      .orderBy(desc(notesTable.updatedAt))
      .limit(sqlLimit);

    rawNotes = rawNotes.map((note) => {
      let highlightedPreview = note.preview || '';

      if (isSearchActive) {
        // Экранируем спецсимволы в поисковом запросе на всякий случай
        const escapedSearch = searchPattern.replace(
          /[-\/\\^$*+?.()|[\]{}]/g,
          '\\$&'
        );

        // Создаем регистронезависимое регулярное выражение
        const regex = new RegExp(`(${escapedSearch})`, 'gi');

        // Оборачиваем все совпадения в точно такие же теги mark!
        highlightedPreview = highlightedPreview.replace(
          regex,
          '<mark class="bg-amber-500/20 text-amber-300 px-0.5 rounded">$1</mark>'
        );
      }

      return {
        ...note,
        preview: highlightedPreview, // отдаем на фронтенд строку с уже готовой подсветкой!
      };
    });

    const hasMore = rawNotes.length > parsedLimit;
    const items = hasMore ? rawNotes.slice(0, parsedLimit) : rawNotes;

    let nextCursor: string | null = null;
    if (items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = lastItem.updatedAt;
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

    return note || null;
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

  // 🔄 4. BULK MOVE: МАССОВОЕ ПЕРЕМЕЩЕНИЕ С АТОМАРНЫМ ОПТИМИСТИЧНЫМ КОНТРОЛЕМ ВЕРСИЙ
  async bulkMove(
    payload: BulkMovePayload,
    userId: string
  ): Promise<{ success: boolean; conflict?: boolean }> {
    const { items, targetFolderId } = payload;
    const noteIds = items.map((i) => i.id);

    const result = await this.db.transaction(async (tx) => {
      // А. Собираем уникальные ID всех старых папок, откуда забираем заметки, чтобы потом обновить их счетчики
      const oldNotes = await tx
        .select({ folderId: notesTable.folderId })
        .from(notesTable)
        .where(
          and(
            sql`${notesTable.id} IN ${noteIds}`,
            eq(notesTable.userId, userId)
          )
        );

      const uniqueOldFolderIds = Array.from(
        new Set(oldNotes.map((n) => n.folderId).filter(Boolean))
      );

      // Б. Проверяем версии для предотвращения Race Condition (Оптимистичная блокировка)
      for (const item of items) {
        const [currentNote] = await tx
          .select({ version: notesTable.version })
          .from(notesTable)
          .where(
            and(eq(notesTable.id, item.id), eq(notesTable.userId, userId))
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
            folderId: targetFolderId || null,
            version: sql`${notesTable.version} + 1`,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(
            and(eq(notesTable.id, item.id), eq(notesTable.userId, userId))
          );
      }

      // Г. Атомарно пересчитываем счетчики во ВСЕХ затронутых старых папках
      if (uniqueOldFolderIds.length > 0) {
        for (const fId of uniqueOldFolderIds) {
          await tx
            .update(foldersTable)
            .set({
              notesCount: sql`(SELECT COUNT(*) FROM ${notesTable} WHERE ${notesTable.folderId} = ${foldersTable.id} AND ${notesTable.isArchived} = false AND ${notesTable.isDeleted} = false)`,
            })
            .where(eq(foldersTable.id, fId as string));
        }
      }

      // Д. Атомарно пересчитываем счетчик для НОВОЙ папки
      if (targetFolderId) {
        await tx
          .update(foldersTable)
          .set({
            notesCount: sql`(SELECT COUNT(*) FROM ${notesTable} WHERE ${notesTable.folderId} = ${foldersTable.id} AND ${notesTable.isArchived} = false AND ${notesTable.isDeleted} = false)`,
          })
          .where(eq(foldersTable.id, targetFolderId));
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

  async updateNote(
    payload: UpdateNotePayload,
    userId: string
  ): Promise<{ conflict: true; note: null } | { conflict: false; note: Note }> {
    const { id, version, title, content } = payload;

    // Собираем динамический объект полей для апдейта
    const updateFields: Record<string, any> = {
      // Атомарно увеличиваем версию на 1 при каждом успешном сохранении!
      version: sql`${notesTable.version} + 1`,
      updatedAt: new Date().toISOString(), // обновляем таймстамп
    };

    if (title !== undefined) updateFields.title = title.trim();
    if (content !== undefined) updateFields.content = content;

    // Выполняем апдейт с проверкой версии (наш оптимистичный замок)
    const [updatedNote] = await this.db
      .update(notesTable)
      .set(updateFields)
      .where(
        and(
          eq(notesTable.id, id),
          eq(notesTable.userId, userId),
          eq(notesTable.version, version) // Строго проверяем, что версия не изменилась!
        )
      )
      .returning();

    // 💥 Если база ничего не вернула, значит версия в БД уже больше, чем прислал фронтенд
    if (!updatedNote) {
      return { conflict: true, note: null };
    }

    // Возвращаем структуру, готовую для фронтенда (как в твоем getNoteById)
    return {
      conflict: false,
      note: {
        ...updatedNote,
        preview: (updatedNote.content || '').substring(0, 150),
        // Теги подтянутся кэшем или отдельным селектом, если нужно,
        // но для сохранения контента в редакторе достаточно вернуть саму заметку
      },
    };
  }
}
