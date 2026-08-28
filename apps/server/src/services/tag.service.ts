import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import { tagsTable, notesTagsTable } from '@synapse-kms/shared';

export class TagService {
  constructor(private db: PostgresJsDatabase<any>) {}

  // 🪄 Тот самый смарт-метод привязки тега
  async attachTag(noteId: string, tagName: string, userId: string) {
    const cleanName = tagName.trim().toLowerCase();

    // 1. Вставляем тег, если его нет, либо берем существующий (смарт-инсерт)
    const [tag] = await this.db
      .insert(tagsTable)
      .values({ name: cleanName })
      .onConflictDoUpdate({
        target: tagsTable.name,
        set: { name: cleanName }, // фиктивный апдейт для получения ID
      })
      .returning();

    // 2. Проверяем, не привязан ли уже этот тег к этой заметке
    const [existingLink] = await this.db
      .select()
      .from(notesTagsTable)
      .where(
        and(
          eq(notesTagsTable.note_id, noteId),
          eq(notesTagsTable.tag_id, tag.id)
        )
      );

    // 3. Если связи нет — создаем её в таблице-мосте
    if (!existingLink) {
      await this.db.insert(notesTagsTable).values({
        note_id: noteId,
        tag_id: tag.id,
      });
    }

    return { success: true, tag: { id: tag.id, name: tag.name } };
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
