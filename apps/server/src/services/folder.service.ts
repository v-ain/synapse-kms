import { eq, and, sql as drizzleSql, desc } from 'drizzle-orm';
import {
  folderSharesTable,
  foldersTable,
  notesTable,
} from '@synapse-kms/shared';
import type {
  DeleteFolderPayload,
  Folder,
  FolderWithRole,
} from '@synapse-kms/shared';
import { DrizzleDB } from 'src/db.js';
import { IFolderService } from '@synapse-kms/trpc';

export class FolderService implements IFolderService {
  constructor(private db: DrizzleDB) {}

  // 1. ПОЛУЧИТЬ ВСЕ ДОСТУПНЫЕ ПАПКИ (Личные + Расшаренные)
  async getFolders(userId: string): Promise<FolderWithRole[]> {
    // 1. Одним запросом забираем и личные папки, и доступы к чужим
    const userData = await this.db.query.usersTable.findFirst({
      where: (users, { eq }) => eq(users.id, userId),
      with: {
        // А. Тянем личные папки
        folders: {
          where: (folders, { eq }) => eq(folders.isDeleted, false),
        },
        // Б. Тянем записи шеринга чужих папок
        shares: {
          with: {
            folder: true, // Проваливаемся сквозь мост прямо в тело чужой папки!
          },
        },
      },
    });

    if (!userData) return [];

    // 2. Превращаем личные папки в нужный формат
    const myFolders: FolderWithRole[] = userData.folders.map((f) => ({
      ...f,
      isShared: false,
    }));

    // 3. Достаем чужие папки из записей шеринга (игнорируя удаленные)
    const sharedFolders: FolderWithRole[] = userData.shares
      .map((s) => s.folder)
      .filter((f): f is NonNullable<typeof f> => f !== null && !f.isDeleted)
      .map((f) => ({
        ...f,
        isShared: true,
      }));

    // 4. Склеиваем массивы и сортируем по дате создания (как и было в UNION)
    return [...myFolders, ...sharedFolders].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // 2. МЕТОД ДЛЯ ВЫДАЧИ ПРАВ
  async shareFolder(params: {
    folderId: string;
    ownerId: string;
    targetUserId: string;
    accessLevel: 'read' | 'write';
  }): Promise<string | null> {
    return await this.db.transaction(async (tx) => {
      // Жесткий ручной замок на строку папки для предотвращения дедлоков
      const [ownedFolder] = await tx
        .select()
        .from(foldersTable)
        .where(
          and(
            eq(foldersTable.id, params.folderId),
            eq(foldersTable.userId, params.ownerId) // Проверяем, что запрашивающий — владелец
          )
        )
        .for('update');

      if (!ownedFolder) {
        return null;
      }

      // Атомарно пишем в таблицу-мост
      const [shareRecord] = await tx
        .insert(folderSharesTable)
        .values({
          folderId: params.folderId,
          userId: params.targetUserId,
          accessLevel: params.accessLevel,
        })
        .returning();

      return shareRecord.id;
    });
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
