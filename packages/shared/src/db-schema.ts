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
  password_hash: text('password_hash').notNull(),
});

// СХЕМА ТАБЛИЦЫ FOLDERS
export const foldersTable = pgTable('folders', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 100 }).notNull(),
  notes_count: integer('notes_count').default(0).notNull(),
  is_deleted: boolean('is_deleted').default(false).notNull(),
  user_id: uuid('user_id')
    .references(() => usersTable.id)
    .notNull(),
  created_at: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// СХЕМА ТАБЛИЦЫ NOTES
export const notesTable = pgTable('notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  folder_id: uuid('folder_id').references(() => foldersTable.id, {
    onDelete: 'set null',
  }),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').default('').notNull(),
  version: integer('version').default(1).notNull(),
  is_archived: boolean('is_archived').default(false).notNull(),
  is_deleted: boolean('is_deleted').default(false).notNull(),
  user_id: uuid('user_id')
    .references(() => usersTable.id)
    .notNull(),
  created_at: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true })
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
    note_id: uuid('note_id')
      .references(() => notesTable.id, { onDelete: 'cascade' })
      .notNull(),
    tag_id: uuid('tag_id')
      .references(() => tagsTable.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => [
    // Составной первичный ключ, чтобы нельзя было привязать один тег к заметке дважды
    primaryKey({ columns: [t.note_id, t.tag_id] }),
  ]
);

// СВЯЗИ ДЛЯ ЗАМЕТОК
export const notesRelations = relations(notesTable, ({ one, many }) => ({
  folder: one(foldersTable, {
    fields: [notesTable.folder_id], // используем ваши snake_case поля из кода
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
    fields: [notesTagsTable.note_id],
    references: [notesTable.id],
  }),
  tag: one(tagsTable, {
    fields: [notesTagsTable.tag_id],
    references: [tagsTable.id],
  }),
}));

// СВЯЗИ ДЛЯ ТЕГОВ
export const tagsRelations = relations(tagsTable, ({ many }) => ({
  notes_tags: many(notesTagsTable),
}));
