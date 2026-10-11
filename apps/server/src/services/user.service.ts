import { IUserService } from '@synapse-kms/trpc';
import { UserEntity } from '@synapse-kms/shared';
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
}
