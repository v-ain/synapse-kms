import { eq, ne } from 'drizzle-orm';
import { IUserService } from '@synapse-kms/trpc';
import { UserEntity, userProfilesTable, usersTable } from '@synapse-kms/shared';
import { DrizzleDB } from '../db.js';

export class UserService implements IUserService {
  constructor(private db: DrizzleDB) {}

  /**
   * 1. Системный поиск корня агрегата (например, для Auth-мидлвари проверки токена)
   */
  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.db.query.usersTable.findFirst({
      where: (users, { eq }) => eq(users.id, id),
    });
    return user || null;
  }

  /**
   * 2. Наш главный метод для ШАРИНГА (Конвертация @username -> ID)
   * Больше никакой почты! Ищем строго по уникальному никнейму.
   */
  async findByUsername(
    username: string
  ): Promise<{ id: string; username: string } | null> {
    const formattedUsername = `@${username.replace(/^@/, '').trim().toLowerCase()}`;

    const [row] = await this.db
      .select({
        id: userProfilesTable.userId,
        username: userProfilesTable.username,
      })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.username, formattedUsername))
      .limit(1);

    return row || null;
  }

  /**
   * 3. Для личного кабинета (Безопасный профиль БЕЗ паролей и БЕЗ email)
   * Фронтенд больше никогда не узнает почту пользователя через этот эндпоинт.
   */
  async getUserProfile(id: string): Promise<{
    id: string;
    username: string;
    displayName: string | null;
    role: string;
  } | null> {
    const [row] = await this.db
      .select({
        id: usersTable.id,
        role: usersTable.role,
        username: userProfilesTable.username,
        displayName: userProfilesTable.displayName,
      })
      .from(usersTable)
      .innerJoin(userProfilesTable, eq(usersTable.id, userProfilesTable.userId))
      .where(eq(usersTable.id, id))
      .limit(1);

    return row || null;
  }

  /**
   * 4. Список всех пользователей для поиска в UI шеринга (Исключая себя)
   * Берем данные напрямую из таблицы профилей
   */
  async getShareableUsers(
    currentUserId: string
  ): Promise<{ id: string; username: string; displayName: string | null }[]> {
    const list = await this.db
      .select({
        id: userProfilesTable.userId,
        username: userProfilesTable.username,
        displayName: userProfilesTable.displayName,
      })
      .from(userProfilesTable)
      .where(
        ne(userProfilesTable.userId, currentUserId) // Не показываем себя в поиске
      );

    return list;
  }
}
