import { eq, and, sql, desc, lt, ilike, or, exists } from 'drizzle-orm';
import {
  notesTable,
  foldersTable,
  notesTagsTable,
  tagsTable,
  folderSharesTable,
  SYSTEM_EVENTS,
  userProfilesTable,
} from '@synapse-kms/shared';

import type {
  Note,
  CreateNotePayload,
  BulkMovePayload,
  PaginatedResponse,
  GetNotesQueryParams,
  NoteWithTags,
  NoteDTO,
  NotePreviewDTO,
  AutoSaveNotePayload,
  CheckNoteAccessResult,
  NoteWriteResult,
  UpdateNoteMetaPayload,
} from '@synapse-kms/shared';

import { INoteLockService, INoteService } from '@synapse-kms/trpc';
import { DrizzleDB } from 'src/db.js';
import { TRPCError } from '@trpc/server';
import { globalEventEmitter } from 'src/infrastructure/events.js';

export class NoteService implements INoteService {
  // Внедряем типизированный инстанс 'db' вместо сырого 'sql'
  constructor(
    private db: DrizzleDB,
    private readonly noteLockService: INoteLockService,
    private userRepository: any
  ) {}

  /**
   * УНИФИЦИРОВАННЫЙ КОНТРОЛЬ ДОСТУПА К ЗАМЕТКАМ (Наследование прав из папок)
   * Объединяет Inbox, создателей и гостей в один ультра-быстрый SQL-запрос
   */
  // packages/api/src/modules/note/note.service.ts
  async checkNoteAccess(
    noteId: string,
    userId: string
  ): Promise<CheckNoteAccessResult> {
    const [row] = await this.db
      .select({
        noteOwnerId: notesTable.userId,
        folderId: notesTable.folderId,
        folderOwnerId: foldersTable.userId,
        guestAccessLevel: folderSharesTable.accessLevel,
      })
      .from(notesTable)
      .leftJoin(foldersTable, eq(notesTable.folderId, foldersTable.id))
      .leftJoin(
        folderSharesTable,
        and(
          eq(notesTable.folderId, folderSharesTable.folderId),
          eq(folderSharesTable.userId, userId)
        )
      )
      .where(and(eq(notesTable.id, noteId), eq(notesTable.isDeleted, false)))
      .limit(1);

    // 1. Заметки нет (или удалена)
    if (!row) {
      return { found: false };
    }

    // 2. Inbox: folderId === null → права только у создателя заметки
    if (row.folderId === null) {
      const isOwner = row.noteOwnerId === userId;
      return isOwner
        ? { found: true, hasAccess: true, accessLevel: 'owner' }
        : { found: true, hasAccess: false };
    }

    // 3. Владелец папки → owner
    if (row.folderOwnerId === userId) {
      return { found: true, hasAccess: true, accessLevel: 'owner' };
    }

    // 4. Гость с шарой папки → read | write
    if (row.guestAccessLevel) {
      return {
        found: true,
        hasAccess: true,
        accessLevel: row.guestAccessLevel as 'read' | 'write',
      };
    }

    // 5. Папка есть, но юзер к ней не относится
    return { found: true, hasAccess: false };
  }

  // 1. ПОЛУЧИТЬ КУРСОРНУЮ ПАГИНАЦИЮ ЗАМЕТОК (Highload O(1) с тегами)
  async getNotes(
    query: GetNotesQueryParams,
    userId: string
  ): Promise<PaginatedResponse<NotePreviewDTO>> {
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
          // Вариант А: Я являюсь владельцем самой папки, в которой лежат заметки
          exists(
            this.db
              .select()
              .from(foldersTable)
              .where(
                and(
                  eq(foldersTable.id, folderId),
                  eq(foldersTable.userId, userId) // Я создал эту папку!
                )
              )
          ),
          // Вариант Б: Я гость, но папка расшарена мне через folderSharesTable
          exists(
            this.db
              .select()
              .from(folderSharesTable)
              .where(
                and(
                  eq(folderSharesTable.folderId, folderId),
                  eq(folderSharesTable.userId, userId)
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
        authorName: userProfilesTable.displayName,
        authorUsername: userProfilesTable.username,
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
      .leftJoin(
        userProfilesTable,
        eq(notesTable.userId, userProfilesTable.userId)
      )
      .where(and(...conditions))
      .groupBy(
        notesTable.id,
        userProfilesTable.username,
        userProfilesTable.displayName
      )
      .orderBy(desc(notesTable.clientUpdatedAt))
      .limit(sqlLimit);

    const hasMore = rawNotes.length > parsedLimit;
    const items = hasMore ? rawNotes.slice(0, parsedLimit) : rawNotes;

    // НАЧАЛО ОБОГАЩЕНИЯ: Вытягиваем замки пачкой за 0.2ms
    const noteIds = items.map((note) => note.id);
    const locksMap = await this.noteLockService.getLocksForNotes(noteIds);

    // Маппим элементы, внедряя лок-информацию в каждую NotePreview карточку
    const enrichedItems: NotePreviewDTO[] = items.map((note) => {
      return {
        id: note.id,
        folderId: note.folderId,
        title: note.title,
        preview: note.preview,
        tags: note.tags,
        clientUpdatedAt: note.clientUpdatedAt,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        // Собираем объект автора из плоского ответа БД
        author: note.authorUsername
          ? {
              username: note.authorUsername,
              displayName: note.authorName || null,
            }
          : null,
        // Данные из Redis
        lock: locksMap[note.id] || {
          isLocked: false,
          lockedBy: null,
          lockedByName: null,
          expiresAt: null,
        },
      };
    });
    // КОНЕЦ ОБОГАЩЕНИЯ

    let nextCursor: string | null = null;
    if (enrichedItems.length > 0) {
      nextCursor = enrichedItems[enrichedItems.length - 1].clientUpdatedAt;
    }

    return {
      items: enrichedItems, // Возвращаем обогащенный массив
      nextCursor: hasMore ? nextCursor : null,
      hasMore: hasMore,
    };
  }

  // 2. ПОЛУЧИТЬ КОНТЕНТ ЗАМЕТКИ ПО ID (Права проверены на уровне API слоя)
  async getNoteById(id: string): Promise<NoteDTO | null> {
    const noteData = await this.db.query.notesTable.findFirst({
      where: (notes, { and, eq }) =>
        and(eq(notes.id, id), eq(notes.isDeleted, false)),
      with: {
        notes_tags: {
          with: {
            tag: true,
          },
        },
        author: true,
      },
    });

    if (!noteData) return null;

    // Заглядываем в Redis за статусом аренды замка
    const lockInfo = await this.noteLockService.getLockInfo(id);

    const tags = noteData.notes_tags.map((nt) => nt.tag.name);

    return {
      id: noteData.id,
      folderId: noteData.folderId,
      title: noteData.title,
      content: noteData.content,
      clientUpdatedAt: noteData.clientUpdatedAt,
      createdAt: noteData.createdAt,
      updatedAt: noteData.updatedAt,
      tags: tags,

      // 🧙‍♂️ Собираем объект автора из реляционных данных
      author: noteData.author
        ? {
            username: noteData.author.username,
            displayName: noteData.author.displayName || null,
          }
        : null,
      // Вживляем статус блокировки в DTO ответа!
      lock: lockInfo,
    };
  }

  // СОЗДАТЬ ЗАМЕТКУ (С КОНТРОЛЕМ DDD ЛИМИТОВ И ЗАЩИТОЙ FOR UPDATE)
  async createNote(payload: CreateNotePayload, userId: string): Promise<Note> {
    const { title, content, folderId } = payload;

    // 1. Открываем транзакцию, чтобы блокировка FOR UPDATE имела юридическую силу в Postgres
    const newNote = await this.db.transaction(async (tx) => {
      // 2. Блокируем строку квоты юзера. Параллельные клики выстроятся в очередь прямо здесь!
      const userAggregate = await this.userRepository.findByIdForUpdate(
        userId,
        tx
      );

      if (!userAggregate) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Бизнес-логика прервана: Пользователь не найден в системе.',
        });
      }

      // 3. Проверяем лимиты в памяти Агрегата. Если usedNotes >= maxNotes — вылетит ошибка
      try {
        userAggregate.executeNoteCreation();
      } catch (domainError: any) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: domainError.message, // Передаем красивый текст ошибки на фронтенд
        });
      }

      // 4. АТОМАРНАЯ ВСТАВКА (теперь выполняется внутри безопасного контекста `tx`)
      const [insertedNote] = await tx
        .insert(notesTable)
        .values({
          title: title.trim(),
          content: content || '',
          folderId: folderId || null, // null означает Inbox
          userId: userId,
        })
        .returning();

      if (!insertedNote) {
        tx.rollback(); // Откатываем транзакцию, если инсерт почему-то вернул пустую строку
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Не удалось записать заметку в БД.',
        });
      }

      // 5. Сохраняем инкрементированное состояние квоты в базу данных
      await this.userRepository.save(userAggregate, tx);

      return insertedNote;
    });

    // 6. Снаружи транзакции делаем Fire-and-Forget пуш в SSE-шину событий
    globalEventEmitter.emit(SYSTEM_EVENTS.NOTE_MUTATED, {
      type: 'CREATED',
      noteId: newNote.id,
      folderId: newNote.folderId,
      userId: userId, // Кто создал, чтобы сработал фронтенд-гард "свой-чужой"
    });

    // 7. СТРУКТУРИРОВАННЫЙ ОТВЕТ: Возвращаем объект, обогащая его виртуальными полями
    return {
      ...newNote,
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
    const currentIsoString = new Date().toISOString();

    // Массовое обновление с Lock-Free LWW-защитой и динамическим ACL
    for (const item of items) {
      const [updated] = await this.db
        .update(notesTable)
        .set({
          folderId: targetFolderId || null, // Перемещаем в целевую папку или Inbox
          clientUpdatedAt: item.clientUpdatedAt,
          updatedAt: currentIsoString,
        })
        .where(
          and(
            eq(notesTable.id, item.id),
            // Атомарный фильтр времени LWW
            lt(notesTable.clientUpdatedAt, item.clientUpdatedAt),

            // ХИТРЫЙ ACL ФИЛЬТР НА УРОВНЕ СУБД:
            // Пользователь может сдвинуть заметку, ТУЛЬКО если:
            or(
              // Кейс А: Он физический создатель этой конкретной заметки
              eq(notesTable.userId, userId),

              // Кейс Б: Заметка лежит в папке, на которую у пользователя есть права 'write' или 'owner'
              exists(
                this.db
                  .select()
                  .from(folderSharesTable)
                  .where(
                    and(
                      eq(folderSharesTable.folderId, notesTable.folderId),
                      eq(folderSharesTable.userId, userId),
                      // Проверяем, что роль гостя в этой папке позволяет редактировать
                      or(
                        eq(folderSharesTable.accessLevel, 'write'),
                        eq(folderSharesTable.accessLevel, 'owner')
                      )
                    )
                  )
              )
            )
          )
        )
        .returning({ id: notesTable.id });

      if (updated) {
        movedIds.push(updated.id);
      }
    }

    return { success: true, movedIds };
  }

  // 5. АРХИВАЦИЯ ЗАМЕТКИ (Чистая атомарная логика без транзакций и пересчетов)
  async archiveNote(
    noteId: string
  ): Promise<{ success: boolean; error?: string; status?: number }> {
    // Просто точечно обновляем статус заметки в базе данных
    const [updatedNote] = await this.db
      .update(notesTable)
      .set({ isArchived: true, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(and(eq(notesTable.id, noteId), eq(notesTable.isDeleted, false)))
      .returning();

    if (!updatedNote) {
      return { success: false, error: 'Заметка не найдена', status: 404 };
    }

    return { success: true };
  }

  /**
   * Атомарное обновление заметки на основе семантики Last-Write-Wins (LWW).
   * Права доступа гарантированы вызывающим слоем API.
   */
  async updateNote(payload: any, userId: string): Promise<any> {
    const { id, clientUpdatedAt, title, content } = payload;

    // 1. Лок — только если держит кто-то другой
    const lock = await this.noteLockService.isLockedByOthers(id, userId);
    if (lock) {
      return { status: 'locked' };
    }

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

    if (!noteData || noteData.isDeleted) {
      return { status: 'gone' };
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
      return { status: 'stale', note: mappedNote };
    }

    return { status: 'updated', note: mappedNote };
  }

  /**
   * Общий write-путь для updateMeta и autoSaveContent.
   * Не собирает DTO, не тянет теги — только применяет изменения и различает исход.
   */
  private async applyNoteWrite(
    noteId: string,
    actorUserId: string,
    clientUpdatedAt: string,
    fields: Partial<Pick<typeof notesTable.$inferInsert, 'title' | 'content'>>
  ): Promise<NoteWriteResult> {
    // 1. Лок
    const lock = await this.noteLockService.isLockedByOthers(
      noteId,
      actorUserId
    );
    if (lock) {
      return {
        status: 'locked',
        lockedBy: actorUserId, //lock.userId,
        lockedByName: null, //lock.displayName ?? null,
      };
    }

    // 2. Атомарный UPDATE с LWW
    const [updated] = await this.db
      .update(notesTable)
      .set({
        ...fields,
        clientUpdatedAt,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(notesTable.id, noteId),
          lt(notesTable.clientUpdatedAt, clientUpdatedAt)
        )
      )
      .returning({ id: notesTable.id });

    if (updated) {
      // best-effort: не влияет на результат write, не часть транзакции
      // void this.noteLockService
      //   .renew(noteId, actorUserId, LOCK_TTL_SECONDS)
      //   .catch((err) => {
      //     this.logger.warn({ err, noteId, actorUserId }, 'lock renew failed after write');
      //   });

      // 6. Снаружи транзакции делаем Fire-and-Forget пуш в SSE-шину событий
      globalEventEmitter.emit(SYSTEM_EVENTS.NOTE_MUTATED, {
        type: 'CREATED',
        noteId: noteId,
      });
      return { status: 'applied' };
    }

    // 3. UPDATE не прошёл — stale или gone
    const exists = await this.db.query.notesTable.findFirst({
      where: and(eq(notesTable.id, noteId), eq(notesTable.isDeleted, false)),
      columns: { id: true },
    });

    return exists ? { status: 'stale' } : { status: 'gone' };
  }

  // Публичные методы — тонкие обёртки
  async updateMeta(
    payload: UpdateNoteMetaPayload,
    actorUserId: string
  ): Promise<NoteWriteResult> {
    return this.applyNoteWrite(
      payload.noteId,
      actorUserId,
      payload.clientUpdatedAt,
      { title: payload.title.trim() }
    );
  }

  async autoSaveContent(
    payload: AutoSaveNotePayload,
    actorUserId: string
  ): Promise<NoteWriteResult> {
    return this.applyNoteWrite(
      payload.noteId,
      actorUserId,
      payload.clientUpdatedAt,
      { content: payload.content }
    );
  }
}
