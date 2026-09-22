import { eq, and, sql as drizzleSql } from 'drizzle-orm';
import { foldersTable, notesTable } from '@synapse-kms/shared';
import type { Folder } from '@synapse-kms/shared';
import { DrizzleDB } from 'src/db.js';
import { IFolderService } from '@synapse-kms/trpc';

export class FolderService implements IFolderService {
  constructor(private db: DrizzleDB) {}

  // Получить только ЖИВЫЕ папки текущего юзера
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

  // Создать новую папку
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

  // Мягкое удаление папки (Enterprise транзакция с проверкой существования)
  async deleteFolder(
    id: string,
    userId: string
  ): Promise<
    | { error: string; status: number; success?: never }
    | { error: null; success: true; status?: never }
  > {
    // 1. Проверяем, существует ли живая папка у этого пользователя
    const [existingFolder] = await this.db
      .select()
      .from(foldersTable)
      .where(
        and(
          eq(foldersTable.id, id),
          eq(foldersTable.user_id, userId),
          eq(foldersTable.is_deleted, false)
        )
      )
      .limit(1);

    if (!existingFolder) {
      return {
        error: 'Папка не найдена или уже была удалена',
        status: 404,
      };
    }

    // 2. Если папка на месте, запускаем ACID-транзакцию через Drizzle
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
          version: drizzleSql`${notesTable.version} + 1`,
          // Внимание: так как в заметках включен mode: 'string',
          // CURRENT_TIMESTAMP в Postgres запишется идеально, и Drizzle вернет строку!
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

    return { error: null, success: true };
  }
}
