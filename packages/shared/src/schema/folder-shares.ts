import { pgTable, uuid, index, unique, pgEnum } from 'drizzle-orm/pg-core';
import { usersTable, foldersTable } from './db-schema.js';

// 1. Создаем перечисление (Enum) для уровней доступа прямо в PostgreSQL
export const accessLevelEnum = pgEnum('access_level', ['read', 'write']);

export const folderSharesTable = pgTable(
  'folder_shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    folderId: uuid('folder_id')
      .references(() => foldersTable.id, { onDelete: 'cascade' }) // Если папка удалена — доступы чистятся автоматически
      .notNull(),

    userId: uuid('user_id')
      .references(() => usersTable.id, { onDelete: 'cascade' })
      .notNull(),

    accessLevel: accessLevelEnum('access_level').default('read').notNull(),
  },
  (table) => {
    return {
      // Уникальный составной индекс: защищает базу от дубликатов (нельзя дважды расшарить одну папку одному юзеру)
      // И он же обеспечивает космическую скорость O(log N) при проверке прав доступа!
      folderUserUniqueIdx: unique('folder_user_unique_idx').on(
        table.folderId,
        table.userId
      ),

      // Дополнительный индекс для обратного поиска: "найти все ЧУЖИЕ папки, к которым у этого юзера есть доступ"
      userFolderIdx: index('share_user_id_idx').on(table.userId),
    };
  }
);
