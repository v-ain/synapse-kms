import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { User } from '../model/User.js';
import { UserQuota } from '../value-objects/UserQuota.js';
import { usersTable } from '@synapse-kms/shared';

export class UserRepository {
  // Передаем инстанс Drizzle через конструктор (Dependency Injection)
  constructor(private readonly db: NodePgDatabase<any>) {}

  /**
   * 🔒 НАХОДИМ И БЛОКИРУЕМ СТРОКУ ДЛЯ ПАРАЛЛЕЛЬНЫХ ПОТОКОВ
   * tx — обязательный клиент транзакции
   */
  async findByIdForUpdate(id: string, tx: any): Promise<User | null> {
    const [row] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .for('update') // Защита от Race Condition! Потоки выстраиваются в очередь.
      .limit(1);

    if (!row) return null;

    // Собираем Value Object квот из полей монолитной таблицы
    const quota = new UserQuota({
      tier: row.tier as 'free' | 'pro',
      maxNotes: row.maxNotes,
      usedNotes: row.usedNotes,
      maxStorageMb: 50, // Дефолтное значение для первой итерации
    });

    // Собираем Агрегат. доменный Агрегат через фабрику
    return User.create({
      id: row.id,
      role: row.role as 'admin' | 'user',
      status: 'active',
      username: row.username, // Скрипт миграции гарантировал, что тут не NULL!
      displayName: row.displayName,
      quota: quota,
    });
  }

  /**
   * СОХРАНЯЕМ ИЗМЕНЕННОЕ СОСТОЯНИЕ АГРЕГАТА В БАЗУ
   */
  async save(user: User, tx: any): Promise<void> {
    await tx
      .update(usersTable)
      .set({
        usedNotes: user.quota.usedNotes,
        // Если в будущем будем менять никнейм или тариф, добавим поля сюда
        // Сюда можно будет докинуть updatedAt: new Date()
      })
      .where(eq(usersTable.id, user.id));
  }
}
