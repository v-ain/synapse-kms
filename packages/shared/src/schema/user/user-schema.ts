import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { folderSharesTable, foldersTable, notesTable } from '../db-schema.js';

// 1. КОРЕНЬ АГРЕГАТА (Aggregate Root)
export const usersTable = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom().notNull(),
  role: text('role').default('user').notNull(), // admin, user, manager
  status: text('status').default('active').notNull(), // active, suspended, deleted
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. ПРИВАТНЫЕ ДАННЫЕ (Credentials)
// Сюда запираем email и хэш пароля. Доступ имеет ТОЛЬКО AuthService
export const userCredentialsTable = pgTable('user_credentials', {
  id: uuid('id').primaryKey().defaultRandom().notNull(),
  userId: uuid('user_id')
    .references(() => usersTable.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
});

// 3. ПУБЛИЧНЫЙ ПРОФИЛЬ (Profile Entity)
// Это то, что легитимно видит фронтенд и Слой Шаринга
export const userProfilesTable = pgTable('user_profiles', {
  id: uuid('id').primaryKey().defaultRandom().notNull(),
  userId: uuid('user_id')
    .references(() => usersTable.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  username: text('username').unique().notNull(), // @username (Уникальный поисковый ник)
  displayName: text('display_name'), // Томас Андерсон (Отображаемое имя в UI)
  avatarUrl: text('avatar_url'),
});

// 4. СИСТЕМА ЛИМИТОВ И КВОТ (Quotas - Value Object)
export const userQuotasTable = pgTable('user_quotas', {
  id: uuid('id').primaryKey().defaultRandom().notNull(),
  userId: uuid('user_id')
    .references(() => usersTable.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  tier: text('tier').default('free').notNull(), // free, pro, enterprise
  maxNotes: integer('max_notes').default(1000).notNull(), // Лимит на количество заметок
  usedNotes: integer('used_notes').default(0).notNull(), // Текущий счетчик (для быстрого контроля без COUNT(*))
  maxStorageMb: integer('max_storage_mb').default(50).notNull(), // Лимит на папки
});

// ==========================================
// DRIZZLE RELATIONS (Для удобной сборки Агрегата)
// ==========================================

export const usersRelations = relations(usersTable, ({ one, many }) => ({
  credentials: one(userCredentialsTable, {
    fields: [usersTable.id],
    references: [userCredentialsTable.userId],
  }),
  profile: one(userProfilesTable, {
    fields: [usersTable.id],
    references: [userProfilesTable.userId],
  }),
  quota: one(userQuotasTable, {
    fields: [usersTable.id],
    references: [userQuotasTable.userId],
  }),

  folders: many(foldersTable), // Папки, которыми владеет пользователь
  notes: many(notesTable), // Личные заметки пользователя
  shares: many(folderSharesTable), // Доступы к чужим папкам, которые выданы этому пользователю
}));

// Обратные связи для суб-таблиц пользователя
export const userCredentialsRelations = relations(
  userCredentialsTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [userCredentialsTable.userId],
      references: [usersTable.id],
    }),
  })
);

export const userProfilesRelations = relations(
  userProfilesTable,
  ({ one }) => ({
    user: one(usersTable, {
      fields: [userProfilesTable.userId],
      references: [usersTable.id],
    }),
  })
);

export const userQuotasRelations = relations(userQuotasTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [userQuotasTable.userId],
    references: [usersTable.id],
  }),
}));
