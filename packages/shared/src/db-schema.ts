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
  notesCount: integer('notes_count').default(0).notNull(),
  isDeleted: boolean('is_deleted').default(false).notNull(),
  userId: uuid('user_id')
    .references(() => usersTable.id)
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .defaultNow()
    .notNull(),
});

// СХЕМА ТАБЛИЦЫ NOTES
export const notesTable = pgTable('notes', {
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
});

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

// СВЯЗИ ДЛЯ ЗАМЕТОК
export const notesRelations = relations(notesTable, ({ one, many }) => ({
  folder: one(foldersTable, {
    fields: [notesTable.folderId],
    references: [foldersTable.id],
  }),
  notes_tags: many(notesTagsTable),
}));

// СВЯЗИ ДЛЯ ПАПОК
export const foldersRelations = relations(foldersTable, ({ many }) => ({
  notes: many(notesTable),
}));

// СВЯЗИ ДЛЯ СВЯЗУЮЩЕЙ ТАБЛИЦЫ MANY-TO-MANY
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

// СВЯЗИ ДЛЯ ТЕГОВ
export const tagsRelations = relations(tagsTable, ({ many }) => ({
  notes_tags: many(notesTagsTable),
}));
