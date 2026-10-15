import { eq, and, desc, sql } from 'drizzle-orm';
import {
  folderSharesTable,
  foldersTable,
  notesTable,
} from '@synapse-kms/shared';
import type {
  DeleteFolderPayload,
  Folder,
  FolderAccessResult,
  FolderWithRole,
} from '@synapse-kms/shared';
import { DrizzleDB } from 'src/db.js';
import { IFolderService } from '@synapse-kms/trpc';
import type { UserService } from './user.service.js';

export class FolderService implements IFolderService {
  constructor(
    private db: DrizzleDB,
    private userService: UserService
  ) {}

  async checkFolderAccess(
    folderId: string,
    userId: string
  ): Promise<FolderAccessResult> {
    // Выполняем один быстрый реляционный запрос
    const folder = await this.db.query.foldersTable.findFirst({
      where: (folders, { eq }) => eq(folders.id, folderId),
      with: {
        shares: {
          where: (shares, { eq }) => eq(shares.userId, userId),
        },
      },
    });

    // 1. Папка не существует в природе
    if (!folder) {
      return { hasAccess: false, role: null };
    }

    // 2. Текущий пользователь является создателем/владельцем папки
    if (folder.userId === userId) {
      return {
        hasAccess: true,
        role: 'owner',
        accessLevel: 'write', // Владелец всегда имеет права на запись
      };
    }

    // 3. Папка расшарена на этого пользователя (проверяем запись из таблицы-моста)
    if (folder.shares.length > 0) {
      const shareRecord = folder.shares[0];
      return {
        hasAccess: true,
        role: 'guest',
        accessLevel: shareRecord.accessLevel, // 'read' или 'write'
      };
    }

    // 4. Папка существует, но пользователь к ней не имеет никакого отношения
    return { hasAccess: false, role: null };
  }
  // 1. ПОЛУЧИТЬ ВСЕ ДОСТУПНЫЕ ПАПКИ (Личные + Расшаренные)
  async getFolders(userId: string) {
    const rows = await this.db
      .select({
        id: foldersTable.id,
        title: foldersTable.title,
        createdAt: foldersTable.createdAt,
        userId: foldersTable.userId,
        isDeleted: foldersTable.isDeleted,
        // 📊 Считаем количество заметок динамически.
        // База вернет 0, если заметок в папке нет.
        notesCount: sql<number>`COALESCE(count(${notesTable.id})::int, 0)`,
        // 🔔 Будущая фича непрочитанных (вот так легко она добавится!):
        // unreadCount: sql<number>`count(${notesTable.id}) filter (where not ${notesTable.isRead})::int`
      })
      .from(foldersTable)
      // Делаем LEFT JOIN к заметкам, чтобы посчитать их (только не удаленные!)
      .leftJoin(
        notesTable,
        and(
          eq(notesTable.folderId, foldersTable.id),
          eq(notesTable.isDeleted, false)
        )
      )
      // Подключаем таблицу доступов
      .leftJoin(
        folderSharesTable,
        eq(folderSharesTable.folderId, foldersTable.id)
      )
      // Фильтруем: папка должна быть не удалена И принадлежать юзеру ИЛИ быть расшаренной на него
      .where(
        and(
          eq(foldersTable.isDeleted, false),
          sql`(${foldersTable.userId} = ${userId} OR ${folderSharesTable.userId} = ${userId})`
        )
      )
      // Группируем по уникальным полям папки, чтобы агрегат count() отработал корректно
      .groupBy(foldersTable.id)
      .orderBy(desc(foldersTable.createdAt));

    // Проставляем флаг isShared на основе сравнения создателя
    return rows.map((row) => ({
      ...row,
      isShared: row.userId !== userId,
    }));
  }

  // 2. МЕТОД ДЛЯ ВЫДАЧИ ПРАВ (С конвертацией Email -> ID и LWW/OnConflict защитой)
  async shareFolder(params: {
    folderId: string;
    ownerId: string;
    targetEmail: string; // 🚀 Принимаем Email вместо сырого ID
    accessLevel: 'read' | 'write';
  }): Promise<{
    success: boolean;
    sharedWith: string;
    accessLevel: 'read' | 'write';
  }> {
    const { folderId, ownerId, targetEmail, accessLevel } = params;

    // 1. Проверяем, что запрашивающий — реально владелец папки (Реляционный стиль)
    const ownedFolder = await this.db.query.foldersTable.findFirst({
      where: (folders, { and, eq }) =>
        and(
          eq(folders.id, folderId),
          eq(folders.userId, ownerId),
          eq(folders.isDeleted, false)
        ),
    });

    if (!ownedFolder) {
      throw new Error(
        '403: Папка не найдена или вы не являетесь её владельцем'
      );
    }

    // 2. Идем в UserService за ID целевого пользователя
    const targetUser = await this.userService.findByEmail(targetEmail);

    if (!targetUser) {
      throw new Error(
        '404: Пользователь с таким Email не зарегистрирован в системе'
      );
    }

    if (targetUser.id === ownerId) {
      throw new Error('400: Нельзя расшарить папку самому себе');
    }

    // 3. Атомарно пишем в таблицу-мост с upsert-механикой (onConflictDoUpdate)
    const [shareRecord] = await this.db
      .insert(folderSharesTable)
      .values({
        folderId,
        userId: targetUser.id,
        accessLevel,
      })
      // Если папка уже была расшарена этому юзеру, просто атомарно обновляем ему роль (например, с read на write)
      .onConflictDoUpdate({
        target: [folderSharesTable.folderId, folderSharesTable.userId],
        set: { accessLevel },
      })
      .returning();

    return {
      success: true,
      sharedWith: targetUser.email,
      accessLevel: shareRecord.accessLevel,
    };
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
