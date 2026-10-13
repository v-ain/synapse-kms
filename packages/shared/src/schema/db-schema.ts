import { relations } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  varchar,
  primaryKey,
  index,
  pgEnum,
  unique,
} from 'drizzle-orm/pg-core';

// СХЕМА ТАБЛИЦЫ USERS
export const usersTable = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom().notNull(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').default('user').notNull(),
});

// СХЕМА ТАБЛИЦЫ FOLDERS
export const foldersTable = pgTable('folders', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 100 }).notNull(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  userId: uuid('user_id')
    .references(() => usersTable.id)
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .defaultNow()
    .notNull(),
});

// СХЕМА ТАБЛИЦЫ NOTES
export const notesTable = pgTable(
  'notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    folderId: uuid('folder_id').references(() => foldersTable.id, {
      onDelete: 'set null',
    }),
    title: varchar('title', { length: 255 }).notNull(),
    content: text('content').default('').notNull(),
    isArchived: boolean('is_archived').default(false).notNull(),
    isDeleted: boolean('is_deleted').default(false).notNull(),
    userId: uuid('user_id')
      .references(() => usersTable.id)
      .notNull(),
    // Метка точного времени изменения на клиенте для разрешения гонок (LWW)
    clientUpdatedAt: timestamp('client_updated_at', {
      withTimezone: true,
      mode: 'string',
    })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      // Единственный, монолитный индекс, который закроет 100% потребностей getNotes
      notesPerfIdx: index('notes_perf_idx').on(
        table.userId,
        table.isDeleted,
        table.isArchived,
        table.clientUpdatedAt.desc()
      ),
    };
  }
);

// СХЕМА ТАБЛИЦЫ TAGS
export const tagsTable = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).unique().notNull(),
});

// Сводная таблица связей заметок и тегов (Many-to-Many)
export const notesTagsTable = pgTable(
  'notes_tags',
  {
    noteId: uuid('note_id')
      .references(() => notesTable.id, { onDelete: 'cascade' })
      .notNull(),
    tagId: uuid('tag_id')
      .references(() => tagsTable.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => [
    // Составной первичный ключ, чтобы нельзя было привязать один тег к заметке дважды
    primaryKey({ columns: [t.noteId, t.tagId] }),
  ]
);

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

// 1. СВЯЗИ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ (Users)
export const usersRelations = relations(usersTable, ({ many }) => ({
  folders: many(foldersTable), // Папки, которыми владеет пользователь
  notes: many(notesTable), // Личные заметки пользователя
  shares: many(folderSharesTable), // Доступы к чужим папкам, которые выданы этому пользователю
}));

// 2. СВЯЗИ ДЛЯ ПАПОК (Folders)
export const foldersRelations = relations(foldersTable, ({ one, many }) => ({
  // У папки есть один владелец (пользователь)
  author: one(usersTable, {
    fields: [foldersTable.userId],
    references: [usersTable.id],
  }),
  notes: many(notesTable), // Заметки внутри этой папки
  shares: many(folderSharesTable), // Все пользователи, которым расшарена эта папка
}));

// 3. СВЯЗИ ДЛЯ ЗАМЕТОК (Notes)
export const notesRelations = relations(notesTable, ({ one, many }) => ({
  // Заметка принадлежит одной папке (может быть null для Inbox)
  folder: one(foldersTable, {
    fields: [notesTable.folderId],
    references: [foldersTable.id],
  }),
  // Заметка принадлежит конкретному автору
  author: one(usersTable, {
    fields: [notesTable.userId],
    references: [usersTable.id],
  }),
  notes_tags: many(notesTagsTable), // Связь M2M с тегами
}));

// 4. СВЯЗИ ДЛЯ СВЯЗУЮЩЕЙ ТАБЛИЦЫ ЗАМЕТКИ-ТЕГИ (Many-to-Many)
export const notesTagsRelations = relations(notesTagsTable, ({ one }) => ({
  note: one(notesTable, {
    fields: [notesTagsTable.noteId],
    references: [notesTable.id],
  }),
  tag: one(tagsTable, {
    fields: [notesTagsTable.tagId],
    references: [tagsTable.id],
  }),
}));

// 5. СВЯЗИ ДЛЯ ТЕГОВ (Tags)
export const tagsRelations = relations(tagsTable, ({ many }) => ({
  notes_tags: many(notesTagsTable), // Тег может быть привязан ко многим заметкам
}));

// 6. СВЯЗИ ДЛЯ ТАБЛИЦЫ ШЕРИНГА (Folder Shares)
export const folderSharesRelations = relations(
  folderSharesTable,
  ({ one }) => ({
    // Каждая запись шеринга указывает на одну конкретную папку
    folder: one(foldersTable, {
      fields: [folderSharesTable.folderId],
      references: [foldersTable.id],
    }),
    // Каждая запись указывает на одного конкретного пользователя, которому дали доступ
    user: one(usersTable, {
      fields: [folderSharesTable.userId],
      references: [usersTable.id],
    }),
  })
);
