import { eq, and, sql as drizzleSql, desc } from 'drizzle-orm';
import {
  folderSharesTable,
  foldersTable,
  notesTable,
} from '@synapse-kms/shared';
import type { DeleteFolderPayload, Folder } from '@synapse-kms/shared';
import { DrizzleDB } from 'src/db.js';
import { IFolderService } from '@synapse-kms/trpc';

export class FolderService implements IFolderService {
  constructor(private db: DrizzleDB) {}

  // 1. ПОЛУЧИТЬ ВСЕ ДОСТУПНЫЕ ПАПКИ (Личные + Расшаренные)
  async getFolders(userId: string): Promise<Folder[]> {
    // Запрос А: Мои личные живые папки
    const myFoldersQuery = this.db
      .select({
        id: foldersTable.id,
        title: foldersTable.title,
        userId: foldersTable.userId, // Будет видно, кто владелец
        isDeleted: foldersTable.isDeleted,
        createdAt: foldersTable.createdAt,
        notesCount: foldersTable.notesCount,
        // updatedAt: foldersTable.updatedAt,
      })
      .from(foldersTable)
      .where(
        and(eq(foldersTable.isDeleted, false), eq(foldersTable.userId, userId))
      );

    // Запрос Б: Чужие живые папки, к которым мне дали доступ
    const sharedFoldersQuery = this.db
      .select({
        id: foldersTable.id,
        title: foldersTable.title,
        userId: foldersTable.userId, // Поймем, чья это папка
        isDeleted: foldersTable.isDeleted,
        createdAt: foldersTable.createdAt,
        notesCount: foldersTable.notesCount,
        // updatedAt: foldersTable.updatedAt,
      })
      .from(foldersTable)
      // Делаем иннер-джойн с таблицей-мостом, чтобы отфильтровать только расшаренные на меня папки
      .innerJoin(
        folderSharesTable,
        eq(foldersTable.id, folderSharesTable.folderId)
      )
      .where(
        and(
          eq(foldersTable.isDeleted, false),
          eq(folderSharesTable.userId, userId) // Бьем точно по индексу share_user_id_idx!
        )
      );

    // Склеиваем два запроса через UNION и сортируем по времени создания
    // Чтобы UNION работал, структуры объектов в select() выше должны строго совпадать до последнего поля!
    return myFoldersQuery
      .unionAll(sharedFoldersQuery)
      .orderBy(desc(foldersTable.createdAt));
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
