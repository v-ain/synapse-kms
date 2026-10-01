import {
  tagsTable,
  notesTagsTable,
  Tag,
  AttachTagPayload,
  notesTable,
  TagWithCount,
} from '@synapse-kms/shared';
import { DrizzleDB } from 'src/db.js';
import { eq, count } from 'drizzle-orm';
import { ITagService } from '@synapse-kms/trpc';

export class TagService implements ITagService {
  constructor(private db: DrizzleDB) {}

  // смарт-метод привязки тега
  async attachTag(
    payload: AttachTagPayload,
    userId: string
  ): Promise<{ success: true; tag: Tag }> {
    // Из payload уже прилетает очищенный, lowercase тег благодаря Zod .transform()!
    const { noteId, tagName } = payload;

    // 1. Вставляем тег, если его нет, либо берем существующий (смарт-инсерт)
    const [tag] = await this.db
      .insert(tagsTable)
      .values({ name: tagName })
      .onConflictDoUpdate({
        target: tagsTable.name,
        set: { name: tagName }, // фиктивный апдейт для получения ID
      })
      .returning();

    // 2. Вставляем связь (.onConflictDoNothing(), чтобы не словить ошибку дубликата связи)
    await this.db
      .insert(notesTagsTable)
      .values({
        noteId: noteId,
        tagId: tag.id,
      })
      .onConflictDoNothing();

    return { success: true, tag };
  }

  // Метод получения всех уникальных тегов пользователя со счётчиком заметок
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
      .where(eq(notesTable.userId, userId))
      .groupBy(tagsTable.id, tagsTable.name);

    return result.map((item) => ({
      ...item,
      notesCount: Number(item.notesCount),
    }));
  }
}
