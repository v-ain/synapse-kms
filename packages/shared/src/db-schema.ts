import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';

// 📁 СХЕМА ТАБЛИЦЫ FOLDERS
export const foldersTable = pgTable('folders', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  notes_count: integer('notes_count').default(0).notNull(),
  is_deleted: boolean('is_deleted').default(false).notNull(),
  user_id: uuid('user_id').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// 📝 СХЕМА ТАБЛИЦЫ NOTES
export const notesTable = pgTable('notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  folder_id: uuid('folder_id').references(() => foldersTable.id), // Внешний ключ!
  title: text('title').notNull(),
  content: text('content').default('').notNull(),
  version: integer('version').default(1).notNull(),
  is_archived: boolean('is_archived').default(false).notNull(),
  is_deleted: boolean('is_deleted').default(false).notNull(),
  user_id: uuid('user_id').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// 🏷️ СХЕМА ТАБЛИЦЫ TAGS
export const tagsTable = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').unique().notNull(),
});

// Сводная таблица связей заметок и тегов (Many-to-Many)
export const notesTagsTable = pgTable('notes_tags', {
  note_id: uuid('note_id')
    .references(() => notesTable.id, { onDelete: 'cascade' })
    .notNull(),
  tag_id: uuid('tag_id')
    .references(() => tagsTable.id, { onDelete: 'cascade' })
    .notNull(),
});
