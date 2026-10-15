import { ne } from 'drizzle-orm';
import { IUserService } from '@synapse-kms/trpc';
import { UserEntity, usersTable } from '@synapse-kms/shared';
import { DrizzleDB } from '../db.js';

export class UserService implements IUserService {
  constructor(private db: DrizzleDB) {}

  // Для внутренних системных проверок и мидлваров
  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.db.query.usersTable.findFirst({
      where: (users, { eq }) => eq(users.id, id),
    });
    return user || null;
  }

  // Наш главный метод для ШАРИНГА (конвертация Email -> ID на бэкенде)
  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.db.query.usersTable.findFirst({
      where: (users, { eq }) => eq(users.email, email.trim().toLowerCase()),
    });
    return user || null;
  }

  // Для публичного личного кабинета (безопасно отсекаем хэш пароля)
  async getUserProfile(
    id: string
  ): Promise<Omit<UserEntity, 'passwordHash'> | null> {
    const user = await this.db.query.usersTable.findFirst({
      columns: {
        id: true,
        email: true,
        role: true,
      },
      where: (users, { eq }) => eq(users.id, id),
    });
    return user || null;
  }

  /**
   * Получить список всех пользователей системы для шеринга (исключая себя)
   */
  async getShareableUsers(
    currentUserId: string
  ): Promise<{ id: string; email: string }[]> {
    const list = await this.db
      .select({
        id: usersTable.id,
        email: usersTable.email,
      })
      .from(usersTable)
      .where(
        ne(usersTable.id, currentUserId) // Защита: не показываем себя в списке
      );

    return list;
  }
}
