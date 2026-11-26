import type { InferSelectModel } from 'drizzle-orm';
import type { foldersTable } from '../schema/db-schema.js';
import { z } from 'zod';

export type FolderRawDB = InferSelectModel<typeof foldersTable>;

export type FolderDTO = {
  id: string;
  title: string;
  ownerId: string;
  createdAt: string;
  notesCount: number;
};

export type FolderWithAccess = FolderDTO & {
  accessLevel: 'read' | 'write' | 'owner';
};

export type CheckFolderAccessResult =
  | { found: false }
  | { found: true; hasAccess: false }
  | { found: true; hasAccess: true; accessLevel: 'read' | 'write' | 'owner' };

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
