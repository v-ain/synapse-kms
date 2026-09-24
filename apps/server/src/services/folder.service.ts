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
        and(eq(foldersTable.isDeleted, false), eq(foldersTable.userId, userId))
      )
      .orderBy(drizzleSql`${foldersTable.createdAt} DESC`);
  }

  // Создать новую папку
  async createFolder(title: string, userId: string): Promise<Folder> {
    const [folder] = await this.db
      .insert(foldersTable)
      .values({
        title: title.trim(),
        userId: userId,
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
          eq(foldersTable.userId, userId),
          eq(foldersTable.isDeleted, false)
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
        .set({ isDeleted: true })
        .where(and(eq(foldersTable.id, id), eq(foldersTable.userId, userId)));

      // Б. Выбрасываем живые заметки из этой папки во Входящие (NULL)
      await tx
        .update(notesTable)
        .set({
          folderId: null,
          version: drizzleSql`${notesTable.version} + 1`,
          // Внимание: так как в заметках включен mode: 'string',
          // CURRENT_TIMESTAMP в Postgres запишется идеально, и Drizzle вернет строку!
          updatedAt: drizzleSql`CURRENT_TIMESTAMP`,
        })
        .where(
          and(
            eq(notesTable.folderId, id),
            eq(notesTable.userId, userId),
            eq(notesTable.isDeleted, false)
          )
        );
    });

    return { error: null, success: true };
  }
}
