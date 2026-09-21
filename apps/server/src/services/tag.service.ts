import {
  tagsTable,
  notesTagsTable,
  Tag,
  AttachTagPayload,
} from '@synapse-kms/shared';
import { DrizzleDB } from 'src/db.js';

export class TagService {
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

  // 🔥 Метод получения всех уникальных тегов пользователя (для бокового меню)
  // Соединяем заметки пользователя с тегами через мост
  async getUserTags(userId: string) {
    // Здесь будет SQL-запрос с JOIN, который выберет все теги,
    // привязанные к заметкам текущего пользователя (userId)
    // Пока оставим заглушку, чтобы запустить базовую привязку
    return [];
  }
}
