import { eq, and, sql as drizzleSql } from 'drizzle-orm';
import {
  foldersTable,
  notesTable,
  notesTagsTable,
  tagsTable,
  usersTable,
} from '@synapse-kms/shared';
import type { Folder } from '@synapse-kms/shared';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

const dbSchema = {
  usersTable,
  foldersTable,
  notesTable,
  tagsTable,
  notesTagsTable,
};

export class FolderService {
  // 🧬 Внедряем типизированный инстанс 'db' вместо сырого 'sql'
  constructor(private db: PostgresJsDatabase<typeof dbSchema>) {}

  // 📁 1. Получить только ЖИВЫЕ папки текущего юзера
  async getFolders(userId: string): Promise<Folder[]> {
    return this.db
      .select()
      .from(foldersTable)
      .where(
        and(
          eq(foldersTable.is_deleted, false),
          eq(foldersTable.user_id, userId)
        )
      )
      .orderBy(drizzleSql`${foldersTable.created_at} DESC`); // Используем легкую вставку для сортировки
  }

  // 🏗️ 2. Создать новую папку
  async createFolder(title: string, userId: string): Promise<Folder> {
    const [folder] = await this.db
      .insert(foldersTable)
      .values({
        title: title.trim(),
        user_id: userId,
      })
      .returning();

    return folder;
  }

  // 🗑️ 3. Мягкое удаление папки (Enterprise транзакция на чистом TS!)
  async deleteFolder(id: string, userId: string): Promise<void> {
    // Открываем ACID-транзакцию через Drizzle
    await this.db.transaction(async (tx) => {
      // А. Маркируем папку как удаленную
      await tx
        .update(foldersTable)
        .set({ is_deleted: true })
        .where(and(eq(foldersTable.id, id), eq(foldersTable.user_id, userId)));

      // Б. Выбрасываем живые заметки из этой папки во Входящие (NULL)
      await tx
        .update(notesTable)
        .set({
          folder_id: null,
          // С помощью drizzle-импорта инкрементируем версию и обновляем таймстемп
          version: drizzleSql`${notesTable.version} + 1`,
          updated_at: drizzleSql`CURRENT_TIMESTAMP`,
        })
        .where(
          and(
            eq(notesTable.folder_id, id),
            eq(notesTable.user_id, userId),
            eq(notesTable.is_deleted, false)
          )
        );
    });
  }
}
