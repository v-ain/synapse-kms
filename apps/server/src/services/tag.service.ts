import {
  tagsTable,
  notesTagsTable,
  Tag,
  AttachTagPayload,
  notesTable,
  TagWithCount,
} from '@synapse-kms/shared';
import { DrizzleDB } from 'src/db.js';
import { and, eq, count } from 'drizzle-orm';
import { ITagService } from '@synapse-kms/trpc';

export class TagService implements ITagService {
  constructor(private db: DrizzleDB) {}

  // 1. СМАРТ-МЕТОД ПРИВЯЗКИ ТЕГА (С полной изоляцией пользователей)
  async attachTag(
    payload: AttachTagPayload,
    userId: string
  ): Promise<{ success: true; tag: Tag }> {
    const { noteId, tagName } = payload;

    // Вставляем тег для КОНКРЕТНОГО юзера.
    // Если у этого юзера уже есть такой тег — onConflictDoUpdate просто вытащит его ID
    const [tag] = await this.db
      .insert(tagsTable)
      .values({
        name: tagName,
        userId: userId, // 🛡️ Изоляция
      })
      .onConflictDoUpdate({
        // Указываем таргет: комбинация колонок нашего уникального индекса
        target: [tagsTable.userId, tagsTable.name],
        set: { name: tagName }, // фиктивный апдейт для возврата .returning()
      })
      .returning();

    // Вставляем связь с заметкой
    await this.db
      .insert(notesTagsTable)
      .values({
        noteId: noteId,
        tagId: tag.id,
      })
      .onConflictDoNothing();

    return { success: true, tag };
  }

  // 2. ПОЛУЧЕНИЕ ТЕГОВ ПОЛЬЗОВАТЕЛЯ С ДИНАМИЧЕСКИМ СЧЕТЧИКОМ COUNT
  async getUserTags(userId: string): Promise<TagWithCount[]> {
    const result = await this.db
      .select({
        id: tagsTable.id,
        name: tagsTable.name,
        notesCount: count(notesTagsTable.noteId),
      })
      .from(tagsTable)
      .innerJoin(notesTagsTable, eq(tagsTable.id, notesTagsTable.tagId))
      .innerJoin(notesTable, eq(notesTagsTable.noteId, notesTable.id))
      .where(
        and(
          eq(tagsTable.userId, userId), // 🛡️ Тянем только теги этого юзера
          eq(notesTable.isDeleted, false),
          eq(notesTable.isArchived, false)
        )
      )
      .groupBy(tagsTable.id, tagsTable.name);

    return result;
  }
}
