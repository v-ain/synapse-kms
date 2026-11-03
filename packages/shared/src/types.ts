import { z } from 'zod';
import type { InferSelectModel } from 'drizzle-orm';
import { foldersTable, notesTable, tagsTable } from './schema/db-schema.js';
import type { usersTable } from './schema/user/user-schema.js';

export type Note = InferSelectModel<typeof notesTable> & {
  preview?: string;
  tags?: string[];
};

// Точная и строгая структура заметки, которую возвращает метод getNoteById
export type NoteWithTags = Note & {
  preview: string; // Переопределяем как обязательное поле
  tags: string[]; // Переопределяем как обязательное поле
};

// Базовая структура из БД
export type Folder = InferSelectModel<typeof foldersTable>;

// Полноценный DTO, который реально возвращает репозиторий/сервис чтений
export type FolderDTO = Omit<Folder, 'isDeleted'> & {
  notesCount: number;
  isShared: boolean;
};

// Расширенный вариант, если в будущем для ACL понадобится роль
export type FolderWithRole = FolderDTO & {
  role: 'owner' | 'guest' | null;
};

export interface FolderAccessResult {
  hasAccess: boolean;
  role: 'owner' | 'guest' | null;
  accessLevel?: 'read' | 'write' | 'owner' | null;
}

// Схема для создания папки
export const CreateFolderSchema = z.object({
  title: z
    .string()
    .min(1, { message: 'Название папки не может быть пустым' })
    .max(50, { message: 'Название папки не должно превышать 50 символов' })
    .transform((val) => val.trim()),
});

// Схема для удаления папки
export const DeleteFolderSchema = z.object({
  id: z.string().uuid({ message: 'Некорректный формат ID папки' }),
  clientUpdatedAt: z.string().datetime({ offset: true }),
});

// Экспортируем типы инференса для использования в контрактах сервисов
export type CreateFolderInput = z.infer<typeof CreateFolderSchema>;
export type DeleteFolderPayload = z.infer<typeof DeleteFolderSchema>;

// ==========================================
// ДОМЕННЫЕ ТИПЫ (Авто-вывод из базы данных)
// ==========================================

export type Tag = Omit<InferSelectModel<typeof tagsTable>, 'userId'>;

// Создаем расширенный UI/DTO тип: берем все поля Tag и подмешиваем notes_count
export interface TagWithCount extends Tag {
  notesCount: number;
}

// ==========================================
// СХЕМЫ ВАЛИДАЦИИ И PAYLOADS (Zod)
// ==========================================

// Схема для валидации входных данных при привязке тега
export const AttachTagSchema = z.object({
  noteId: z.string().uuid({ message: 'Некорректный формат ID заметки' }),
  tagName: z
    .string()
    .min(1, { message: 'Тег не может быть пустым' })
    .max(30, { message: 'Тег слишком длинный (макс. 30 символов)' })
    // Смарт-нормализация прямо на входе в систему!
    .transform((val) => val.trim().toLowerCase()),
});

// Автоматически выводим тип Payload для аргументов сервиса из Zod-схемы!
// Получится чистый тип: { noteId: string; tagName: string }
export type AttachTagPayload = z.infer<typeof AttachTagSchema>;

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null; // Передаем таймстемп последней заметки в формате ISO строки
  hasMore: boolean;
}

// Схема пакетного перемещения заметок
export const BulkMovePayloadSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        clientUpdatedAt: z.string().datetime({ offset: true }),
      })
    )
    .min(1),
  targetFolderId: z.string().uuid().nullable(),
});

// TS-типы строятся по схемам валидации!
export type BulkMovePayload = z.infer<typeof BulkMovePayloadSchema>;

// Описываем допустимые значения для фильтра
export const notesFilterSchema = z.enum([
  'all',
  'inbox',
  'archive',
  'folder',
  'tag',
]);
export type NotesFilter = z.infer<typeof notesFilterSchema>;

// 🛡️ Живая Zod-схема для валидации параметров запроса
export const getNotesQueryParamsSchema = z.object({
  folderId: z.string().uuid().optional(),
  filter: notesFilterSchema.optional(),
  limit: z.string().optional(),
  cursor: z.string().optional(),
  search: z.string().optional(),
  tagName: z.string().optional(),
  // cursor: z.string().nullish(), // Обязательно nullish или optional!
});

// Автоматически вытаскиваем TS-тип из схемы (он заменит твой старый interface!)
export type GetNotesQueryParams = z.infer<typeof getNotesQueryParamsSchema>;

// Схема авторизации / регистрации
export const authCredentialsSchema = z.object({
  email: z.string().email({ message: 'Некорректный формат email' }),
  password: z
    .string()
    .min(6, { message: 'Пароль должен быть не менее 6 символов' }),
});

export type AuthCredentials = z.infer<typeof authCredentialsSchema>;

export type UserEntity = InferSelectModel<typeof usersTable>;

// 1. БАЗОВАЯ СХЕМА ДЛЯ ВХОДА (Login)
// Используем её в auth.login роутере
export const loginSchema = z.object({
  email: z.string().email('Некорректный формат email'),
  password: z.string().min(6, 'Пароль должен быть не менее 6 символов'),
});

// 2. РАСШИРЕННАЯ СХЕМА ДЛЯ РЕГИСТРАЦИИ (Register)
// Используем метод .extend(), чтобы не копипастить email и password!
export const registerSchema = loginSchema.extend({
  username: z
    .string()
    .min(3, 'Никнейм должен быть не менее 3 символов')
    .max(20, 'Никнейм не должен превышать 20 символов')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Никнейм может содержать только латинские буквы, цифры и подчеркивание'
    ),
  displayName: z.string().optional(),
});

// Вытаскиваем TypeScript типы напрямую из Zod-схем, чтобы бэкенд и фронтенд их видели
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

// Safe DTO для фронтенда (Никаких хэшей паролей!)
export interface UserDTO {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
  quota: {
    tier: 'free' | 'pro';
    usedNotes: number;
    maxNotes: number;
  };
}

//auth/auth.schema.ts
export const UserRoleSchema = z.enum(['admin', 'user']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const JwtPayloadSchema = z.object({
  userId: z.string().uuid(),
  userRole: UserRoleSchema,
});

export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

export type UserContext = {
  id: string;
  role: UserRole;
};
