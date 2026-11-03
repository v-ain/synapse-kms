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
    // Прямой точечный удар по таблице доступов через B-Tree индекс
    const [shareRecord] = await this.db
      .select({
        accessLevel: folderSharesTable.accessLevel,
      })
      .from(folderSharesTable)
      .where(
        and(
          eq(folderSharesTable.folderId, folderId),
          eq(folderSharesTable.userId, userId)
        )
      )
      .limit(1);

    // 1. Если записи нет — пользователь не имеет отношения к папке
    // (Либо папки вообще не существует в природе)
    if (!shareRecord) {
      return {
        hasAccess: false,
        role: null,
        accessLevel: null,
      };
    }

    const level = shareRecord.accessLevel as 'read' | 'write' | 'owner';
    const isOwner = level === 'owner';

    // 2. Отдаем однородный, чистый и предсказуемый результат
    return {
      hasAccess: true,
      role: isOwner ? 'owner' : 'guest',
      accessLevel: level, // 'read' | 'write' | 'owner'
    };
  }

  // 1. ПОЛУЧИТЬ ВСЕ ДОСТУПНЫЕ ПАПКИ (Личные + Расшаренные)
  async getFolders(userId: string) {
    const rows = await this.db
      .select({
        id: foldersTable.id,
        title: foldersTable.title,
        createdAt: foldersTable.createdAt,
        ownerId: foldersTable.userId, // Переименовали для прозрачности контекста
        // Наш однородный ACL уровень доступа летит прямо на фронтенд!
        accessLevel: folderSharesTable.accessLevel,
        // Считаем количество живых заметок в папке
        notesCount: sql<number>`COALESCE(count(${notesTable.id})::int, 0)`,
      })
      .from(folderSharesTable)
      // 1. Жестко вяжем саму папку (только не удаленную)
      .innerJoin(
        foldersTable,
        and(
          eq(folderSharesTable.folderId, foldersTable.id),
          eq(foldersTable.isDeleted, false)
        )
      )
      // 2. Мягко вяжем живые заметки для подсчета счетчика
      .leftJoin(
        notesTable,
        and(
          eq(notesTable.folderId, foldersTable.id),
          eq(notesTable.isDeleted, false)
        )
      )
      // ФИЛЬТР: Выгребаем только то, к чему у этого юзера есть запись в ACL
      .where(eq(folderSharesTable.userId, userId))
      // Группируем по ID доступов и папки, чтобы агрегат count() работал корректно
      .groupBy(folderSharesTable.id, foldersTable.id)
      .orderBy(desc(foldersTable.createdAt));

    // Превращаем плоские строки базы в обогащенные DTO для фронтенда
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.createdAt,
      notesCount: row.notesCount,

      // фолбэк для обратной совместимости
      userId: row.ownerId,
      // Больше никаких ручных вычислений флага!
      // Если уровень доступа не owner — значит папка расшарена нам извне. Чисто и понятно.
      isShared: row.accessLevel !== 'owner',
      accessLevel: row.accessLevel as 'read' | 'write' | 'owner',
    }));
  }

  // 2. МЕТОД ДЛЯ ВЫДАЧИ ПРАВ (ОЧИЩЕННЫЙ ACL)
  async shareFolder(params: {
    folderId: string;
    ownerId: string;
    username: string;
    accessLevel: 'read' | 'write';
  }): Promise<{
    success: boolean;
    sharedWith: string;
    accessLevel: 'read' | 'write';
  }> {
    const { folderId, ownerId, username, accessLevel } = params;

    // 1. ownedFolder БОЛЬШЕ НЕ ПИШЕМ! Безопасность гарантирована шлюзом.

    // 2. Идем в UserService за ID целевого пользователя (по нашему новому методу поиска)
    const targetUser = await this.userService.findByUsername(username);

    if (!targetUser) {
      throw new Error(
        `404: Пользователь с никнеймом ${username} не зарегистрирован в системе`
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
      // Если папка уже была расшарена, атомарно обновляем ему роль (с read на write и наоборот)
      .onConflictDoUpdate({
        target: [folderSharesTable.folderId, folderSharesTable.userId],
        set: { accessLevel },
      })
      .returning();

    return {
      success: true,
      sharedWith: targetUser.username,
      accessLevel: shareRecord.accessLevel as 'read' | 'write',
    };
  }

  /**
   * Создать новую папку с автоматической регистрацией владельца в ACL
   */
  async createFolder(title: string, userId: string): Promise<Folder> {
    // Открываем транзакцию, чтобы обе записи создались одновременно
    return await this.db.transaction(async (tx) => {
      // 1. Создаем саму папку в folders
      const [folder] = await tx
        .insert(foldersTable)
        .values({
          title: title.trim(),
          userId: userId, // Оставляем для обратной совместимости метаданных
        })
        .returning();

      // 2. КРИТИЧЕСКИЙ ШАГ ACL: Регистрируем создателя как 'owner' в таблице доступов
      await tx.insert(folderSharesTable).values({
        folderId: folder.id,
        userId: userId,
        accessLevel: 'owner', // Наша новая однородная роль!
      });

      // Возвращаем созданную папку наружу
      return folder;
    });
  }

  async deleteFolder(payload: DeleteFolderPayload): Promise<boolean> {
    const { id, clientUpdatedAt } = payload;
    const currentIsoString = new Date().toISOString();

    const success = await this.db.transaction(async (tx) => {
      // А. Помечаем папку как удаленную. Ищем строго по id папки!
      const [deletedFolder] = await tx
        .update(foldersTable)
        .set({ isDeleted: true })
        .where(and(eq(foldersTable.id, id), eq(foldersTable.isDeleted, false)))
        .returning({ id: foldersTable.id });

      // Если папка не найдена или уже удалена, прерываем транзакцию
      if (!deletedFolder) {
        return false;
      }

      // ЧИСТИМ ACL ХВОСТЫ: Поскольку это Soft Delete папки,
      // удаляем все записи доступов для этой папки вручную!
      await tx
        .delete(folderSharesTable)
        .where(eq(folderSharesTable.folderId, id));
      // Б. Выбрасываем живые заметки из этой папки во Входящие (NULL)
      // ВНИМАНИЕ: мы убрали eq(notesTable.userId, userId)!
      // Теперь даже если гость создал заметку в этой папке, при удалении папки владельцем
      // ВСЕ заметки внутри неё безопасно вылетят в Inbox своих создателей!
      await tx
        .update(notesTable)
        .set({
          folderId: null,
          clientUpdatedAt: clientUpdatedAt,
          updatedAt: currentIsoString,
        })
        .where(
          and(eq(notesTable.folderId, id), eq(notesTable.isDeleted, false))
        );

      return true;
    });

    return success;
  }
}
