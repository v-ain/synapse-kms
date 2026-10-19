import type { Redis } from 'ioredis';
import { INoteLockService, LockAcquireResult } from '@synapse-kms/trpc';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { NoteLockInfo, usersTable } from '@synapse-kms/shared';
import { eq } from 'drizzle-orm';

export class NoteLockService implements INoteLockService {
  private readonly LOCK_TTL = 30; // Блокировка выдается на 30 секунд

  constructor(
    private readonly redis: Redis,
    private readonly db: NodePgDatabase<any>
  ) {}

  private getLockKey(noteId: string): string {
    return `lock:note:${noteId}`;
  }

  /**
   * Попытка захвата блокировки
   */
  async acquire(noteId: string, userId: string): Promise<LockAcquireResult> {
    const key = this.getLockKey(noteId);

    // Атомарная команда SET с флагами NX (только если нет) и EX (время жизни в секундах)
    const acquired = await this.redis.set(
      key,
      userId,
      'EX',
      this.LOCK_TTL,
      'NX'
    );

    if (acquired === 'OK') {
      return { success: true, lockedBy: userId, expiresIn: this.LOCK_TTL };
    }

    // Если не удалось захватить, проверяем, кто текущий владелец
    const currentLockOwner = await this.redis.get(key);

    // Если замок и так наш (например, страница перезагрузилась), просто продлеваем его
    if (currentLockOwner === userId) {
      await this.redis.expire(key, this.LOCK_TTL);
      return { success: true, lockedBy: userId, expiresIn: this.LOCK_TTL };
    }

    // Замок чужой — вычисляем оставшийся TTL
    const ttl = await this.redis.ttl(key);
    return {
      success: false,
      lockedBy: currentLockOwner || '',
      expiresIn: ttl > 0 ? ttl : 0,
    };
  }

  /**
   * Продление блокировки (Heartbeat с фронтенда каждые ~10 сек)
   */
  async renew(noteId: string, userId: string): Promise<boolean> {
    const key = this.getLockKey(noteId);
    const currentLockOwner = await this.redis.get(key);

    // Продлеваем только если замок всё еще принадлежит этому пользователю
    if (currentLockOwner === userId) {
      await this.redis.expire(key, this.LOCK_TTL);
      return true;
    }

    return false;
  }

  /**
   * Атомарное освобождение блокировки через Lua-скрипт
   */
  async release(noteId: string, userId: string): Promise<void> {
    const key = this.getLockKey(noteId);

    // Lua-скрипт гарантирует: мы удалим ключ только если его значение совпадает с userId.
    // Это защищает от ситуации, когда у Юзера А протух TTL, Юзер Б взял блок, а Юзер А вызвал release().
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    await this.redis.eval(luaScript, 1, key, userId);
  }

  /**
   * Дополнительный хелпер для сборки DTO (вызывается в Queries роутера заметок)
   */
  async getLockInfo(noteId: string): Promise<NoteLockInfo> {
    const key = this.getLockKey(noteId);
    const lockedBy = await this.redis.get(key);

    if (!lockedBy) {
      return {
        isLocked: false,
        lockedBy: null,
        lockedByName: null,
        expiresAt: null,
      };
    }

    const ttl = await this.redis.ttl(key);
    const expiresAt = Date.now() + ttl * 1000;

    // Вытягиваем имя/email автора лока для UI-маркера
    const [user] = await this.db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, lockedBy))
      .limit(1);

    return {
      isLocked: true,
      lockedBy,
      lockedByName: user?.email || 'Коллега',
      expiresAt,
    };
  }

  /**
   * Быстрая проверка: заблокирована ли заметка кем-то ДРУГИМ?
   * Возвращает true, если замок держит другой пользователь.
   */
  async isLockedByOthers(noteId: string, userId: string): Promise<boolean> {
    const key = this.getLockKey(noteId);
    const currentLockOwner = await this.redis.get(key);

    // Если замок есть И он принадлежит НЕ текущему юзеру -> true (заблокировано чужаком)
    if (currentLockOwner && currentLockOwner !== userId) {
      return true;
    }

    return false;
  }
}
