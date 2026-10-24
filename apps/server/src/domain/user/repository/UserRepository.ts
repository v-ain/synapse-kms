import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { User } from '../model/User.js';
import { UserQuota } from '../value-objects/UserQuota.js';
import {
  userProfilesTable,
  userQuotasTable,
  usersTable,
} from '@synapse-kms/shared';

export class UserRepository {
  // Передаем инстанс Drizzle через конструктор (Dependency Injection)
  constructor(private readonly db: NodePgDatabase<any>) {}

  /**
   * НАХОДИМ И БЛОКИРУЕМ СТРОКУ КВОТЫ ДЛЯ ПАРАЛЛЕЛЬНЫХ ПОТОКОВ
   * tx — контекст транзакции из NoteService
   */
  async findByIdForUpdate(id: string, tx: any): Promise<User | null> {
    // Делаем джойн корня, профиля и таблицы квот
    const [row] = await tx
      .select({
        id: usersTable.id,
        role: usersTable.role,
        status: usersTable.status,
        username: userProfilesTable.username,
        displayName: userProfilesTable.displayName,
        tier: userQuotasTable.tier,
        maxNotes: userQuotasTable.maxNotes,
        usedNotes: userQuotasTable.usedNotes,
        maxStorageMb: userQuotasTable.maxStorageMb,
      })
      .from(usersTable)
      .innerJoin(userProfilesTable, eq(usersTable.id, userProfilesTable.userId))
      .innerJoin(userQuotasTable, eq(usersTable.id, userQuotasTable.userId))
      .where(eq(usersTable.id, id))
      .for('update', { of: userQuotasTable }) // ХИТРОСТЬ: Блокируем СТРОГУЮ строку в таблице квот!
      .limit(1);

    if (!row) return null;

    // 1. Собираем Value Object квот из полей таблицы user_quotas
    const quota = new UserQuota({
      tier: row.tier as 'free' | 'pro',
      maxNotes: row.maxNotes,
      usedNotes: row.usedNotes,
      maxStorageMb: row.maxStorageMb,
    });

    // 2. Возвращаем полноценный доменный Агрегат
    return User.create({
      id: row.id,
      role: row.role as 'admin' | 'user',
      status: row.status as 'active' | 'suspended',
      username: row.username,
      displayName: row.displayName,
      quota: quota,
    });
  }

  /**
   * АТОМАРНО СОХРАНЯЕМ ИЗМЕНЕНИЯ СЧЕТЧИКОВ
   */
  async save(user: User, tx: any): Promise<void> {
    // Больше никакого апдейта таблицы users!
    // За счетчики теперь отвечает строго таблица user_quotas
    await tx
      .update(userQuotasTable)
      .set({
        usedNotes: user.quota.usedNotes,
        tier: user.quota.tier,
        maxNotes: user.quota.maxNotes,
        maxStorageMb: user.quota.maxStorageMb,
      })
      .where(eq(userQuotasTable.userId, user.id));
  }
}
