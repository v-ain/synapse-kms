import {
  tagsTable,
  notesTagsTable,
  Tag,
  AttachTagPayload,
  notesTable,
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
        note_id: noteId,
        tag_id: tag.id,
      })
      .onConflictDoNothing();

    return { success: true, tag };
  }

  // 🔥 Метод получения всех уникальных тегов пользователя со счётчиком заметок
  async getUserTags(
    userId: string
  ): Promise<Array<{ id: string; name: string; notes_count: number }>> {
    const result = await this.db
      .select({
        id: tagsTable.id,
        name: tagsTable.name,
        // Считаем количество связей тега с заметками этого пользователя
        notes_count: count(notesTagsTable.note_id),
      })
      .from(tagsTable)
      // Соединяем теги с мостом связей many-to-many
      .innerJoin(notesTagsTable, eq(tagsTable.id, notesTagsTable.tag_id))
      // Соединяем мост с самой таблицей заметок
      .innerJoin(notesTable, eq(notesTagsTable.note_id, notesTable.id))
      // Отсекаем чужие заметки, оставляем только синапсы текущего юзера
      .where(eq(notesTable.user_id, userId))
      // Группируем по ID и имени тега, чтобы агрегация count() отработала корректно
      .groupBy(tagsTable.id, tagsTable.name);

    // Drizzle возвращает notes_count как строку (из-за специфики драйверов pg/node-postgres),
    // приводим её к нормальному числу перед отправкой на фронтенд
    return result.map((item) => ({
      ...item,
      notes_count: Number(item.notes_count),
    }));
  }
}
