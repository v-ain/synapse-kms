import { eq, and, sql as drizzleSql } from 'drizzle-orm';
import { foldersTable, notesTable } from '@synapse-kms/shared';
import type { DeleteFolderPayload, Folder } from '@synapse-kms/shared';
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

  async deleteFolder(
    payload: DeleteFolderPayload,
    userId: string
  ): Promise<boolean> {
    const { id, clientUpdatedAt } = payload;
    const currentIsoString = new Date().toISOString();

    const success = await this.db.transaction(async (tx) => {
      // А. Пытаемся пометить папку как удаленную.
      // Если она уже удалена или принадлежит другому юзеру — вернется пустой массив.
      const [deletedFolder] = await tx
        .update(foldersTable)
        .set({ isDeleted: true })
        .where(
          and(
            eq(foldersTable.id, id),
            eq(foldersTable.userId, userId),
            eq(foldersTable.isDeleted, false)
          )
        )
        .returning({ id: foldersTable.id });

      // Если папка не найдена или уже удалена, прерываем транзакцию и возвращаем false
      if (!deletedFolder) {
        return false;
      }

      // Б. Выбрасываем живые заметки из этой папки во Входящие (NULL)
      // Обновляем их timestamps под стратегию LWW
      await tx
        .update(notesTable)
        .set({
          folderId: null,
          clientUpdatedAt: clientUpdatedAt, // Метка времени от действия пользователя
          updatedAt: currentIsoString, // Серверный аудит
        })
        .where(
          and(
            eq(notesTable.folderId, id),
            eq(notesTable.userId, userId),
            eq(notesTable.isDeleted, false)
          )
        );

      return true;
    });

    return success;
  }
}
