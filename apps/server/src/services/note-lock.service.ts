import type { Redis } from 'ioredis';
import { INoteLockService, LockAcquireResult } from '@synapse-kms/trpc';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { NoteLockInfo, userProfilesTable } from '@synapse-kms/shared';
import { eq } from 'drizzle-orm';

export class NoteLockService implements INoteLockService {
  private readonly LOCK_TTL = 30; // Блокировка выдается на 30 секунд

  constructor(
    private readonly redis: Redis,
    private readonly db: NodePgDatabase<any>,
    private noteEventPublisher: any
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
      // Фоновое неблокирующее событие для SSE (Fire-and-Forget)
      // Мы НЕ пишем await перед этим вызовом, ответ клиенту улетит мгновенно!
      this.notifyLockStatusChanged(noteId);

      return { success: true, lockedBy: userId, expiresIn: this.LOCK_TTL };
    }

    // Если не удалось захватить, проверяем, кто текущий владелец
    const currentLockOwner = await this.redis.get(key);

    // Если замок и так наш (например, страница перезагрузилась), просто продлеваем его
    if (currentLockOwner === userId) {
      await this.redis.expire(key, this.LOCK_TTL);

      // Тоже фоново уведомляем, если нужно обновить TTL у других
      this.notifyLockStatusChanged(noteId);
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
      // Тоже фоново уведомляем, если нужно обновить TTL у других
      // this.notifyLockStatusChanged(noteId);
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
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    // Сохраняем результат: 1 — замок успешно удален, 0 — замок не наш/не существовал
    const result = await this.redis.eval(luaScript, 1, key, userId);

    // Если замок реально освобожден нами — фоново пушим в SSE статус "разблокировано"
    if (result === 1) {
      this.notifyLockStatusChanged(noteId);
    }
  }

  /**
   * Дополнительный хелпер для сборки DTO (вызывается в Queries роутера заметок)
   */
  async getLockInfo(noteId: string): Promise<NoteLockInfo> {
    const key = this.getLockKey(noteId);
    const lockedBy = await this.redis.get(key); // Здесь лежит userId того, кто залочил

    if (!lockedBy) {
      return {
        isLocked: false,
        lockedBy: null,
        lockedByName: null,
        expiresAt: null,
      };
    }

    const ttl = await this.redis.ttl(key);
    // Защита: если ключ в Redis вот-вот протухнет, не уходим в отрицательный таймстамп
    const expiresAt = Date.now() + (ttl > 0 ? ttl * 1000 : 0);

    // ⚡️ Напрямую лезем в таблицу профилей за публичным именем
    const [profile] = await this.db
      .select({
        username: userProfilesTable.username,
        displayName: userProfilesTable.displayName,
      })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, lockedBy))
      .limit(1);

    // Собираем красивое отображение для UI:
    // Если есть Display Name — берем его, иначе — @username, иначе — фолбек
    const lockedByName = profile
      ? profile.displayName || profile.username
      : 'Коллега';

    return {
      isLocked: true,
      lockedBy,
      lockedByName,
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

  /**
   * Пакетное получение информации о блокировках для списка заметок (Защита от N+1)
   */
  async getLocksForNotes(
    noteIds: string[]
  ): Promise<Record<string, NoteLockInfo>> {
    const result: Record<string, NoteLockInfo> = {};

    if (!noteIds || noteIds.length === 0) return result;

    // 1. Формируем ключи для Redis
    const lockKeys = noteIds.map((id) => `lock:note:${id}`);

    // 2. Атомарно забираем владельцев замков через MGET
    const lockedUsers = await this.redis.mget(...lockKeys);

    // 3. Через Pipeline забираем TTL всех ключей за один сетевой круг
    const pipeline = this.redis.pipeline();
    lockKeys.forEach((key) => pipeline.ttl(key));
    const ttlResults = await pipeline.exec(); // [[err, ttl], [err, ttl], ...]

    // Используем классический цикл для сопоставления данных
    for (let i = 0; i < noteIds.length; i++) {
      const noteId = noteIds[i];
      const lockedBy = lockedUsers[i];

      // В ioredis результат пайплайна возвращается в виде массива [error, result]
      const ttlResult = ttlResults?.[i];
      const ttl = ttlResult && !ttlResult[0] ? (ttlResult[1] as number) : -2;

      // Если замок есть в Redis и он активен (ttl > 0)
      if (lockedBy && ttl > 0) {
        // Чтобы не спамить базу тяжелыми SELECT к usersTable ради имен в цикле,
        // пока ставим заглушку "Коллега". Когда прикрутим SSE, имя будет прилетать в событии.
        result[noteId] = {
          isLocked: true,
          lockedBy,
          lockedByName: 'Коллега',
          expiresAt: Date.now() + ttl * 1000,
        };
      } else {
        result[noteId] = {
          isLocked: false,
          lockedBy: null,
          lockedByName: null,
          expiresAt: null,
        };
      }
    }

    return result;
  }

  /**
   * Вспомогательный приватный метод для фонового пуша в SSE
   */
  private async notifyLockStatusChanged(noteId: string): Promise<void> {
    try {
      // Спокойно в фоне собираем полноценное DTO (включая SELECT из Postgres внутри getLockInfo)
      const lockInfo = await this.getLockInfo(noteId);

      this.noteEventPublisher.lockUpdated(noteId, {
        type: 'ACQUIRED',
        lock: lockInfo,
        actorUserId: lockInfo.lockedBy,
      });
    } catch (error) {
      // Обязательно логируем ошибки фонового процесса, чтобы они не роняли Node.js
      console.error(
        `[SSE-Notification-Error] Failed for note ${noteId}:`,
        error
      );
    }
  }
}
