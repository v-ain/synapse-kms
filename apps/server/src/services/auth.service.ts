import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import {
  userCredentialsTable,
  userProfilesTable,
  userQuotasTable,
  usersTable,
} from '@synapse-kms/shared';
import { DrizzleDB } from '../db.js';
import type { UserService } from './user.service.js';
import { TRPCError } from '@trpc/server';

const JWT_SECRET =
  process.env.JWT_SECRET || 'super-secret-key-change-me-in-production';

// Описываем расширенный контракт входных данных для регистрации
export interface RegisterUserInput {
  email: string;
  password: string;
  username: string; // 🆕 Обязательный никнейм
  displayName?: string; // Опциональное имя для UI
}

export class AuthService {
  constructor(
    private db: DrizzleDB,
    private userService: UserService
  ) {}
  // 1. Хеширование пароля (scrypt с солью)
  hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = scryptSync(password, salt, 64);
    return `${salt}:${derivedKey.toString('hex')}`;
  }

  // 2. Безопасная проверка пароля (защита от атак по времени)
  verifyPassword(password: string, storedHash: string): boolean {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;

    const derivedKey = scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(key, 'hex');

    return timingSafeEqual(keyBuffer, derivedKey);
  }

  // 3. Генерация компактного JWT токена
  generateToken(userId: string, userRole: string): string {
    return jwt.sign({ userId, userRole }, JWT_SECRET, { expiresIn: '7d' });
  }

  // 4. Валидация JWT токена
  verifyToken(token: string): { userId: string; userRole: string } | null {
    try {
      return jwt.verify(token, JWT_SECRET) as {
        userId: string;
        userRole: string;
      };
    } catch {
      return null;
    }
  }

  /**
   * 🔐 ПРОВЕРКА ПОЛЬЗОВАТЕЛЯ ПРИ ВХОДЕ (LOGIN)
   */
  async validateUser(email: string, password: string) {
    const cleanedEmail = email.trim().toLowerCase();

    // 1. Ищем учетные данные и никнейм через JOIN новых таблиц credentials и profiles
    const [row] = await this.db
      .select({
        id: usersTable.id,
        role: usersTable.role,
        passwordHash: userCredentialsTable.passwordHash,
        username: userProfilesTable.username, // Вытаскиваем никнейм для сессии фронтенда
      })
      .from(usersTable)
      .innerJoin(
        userCredentialsTable,
        eq(usersTable.id, userCredentialsTable.userId)
      )
      .innerJoin(userProfilesTable, eq(usersTable.id, userProfilesTable.userId))
      .where(eq(userCredentialsTable.email, cleanedEmail))
      .limit(1);

    if (!row) return null;

    // 2. Проверяем твой надежный хэш пароля
    const isPasswordValid = this.verifyPassword(password, row.passwordHash);
    if (!isPasswordValid) return null;

    // Возвращаем данные для токена и стора (включая username!)
    return { id: row.id, role: row.role, username: row.username };
  }

  /**
   * 🚀 СОЗДАНИЕ ПОЛЬЗОВАТЕЛЯ (REGISTER) — Теперь пишем в 4 таблицы атомарно!
   */
  async registerUser(input: RegisterUserInput) {
    const { email, password, username, displayName } = input;

    const cleanedEmail = email.trim().toLowerCase();
    const formattedUsername = `@${username.replace(/^@/, '').trim().toLowerCase()}`;

    // 1. Проверяем уникальность email в таблице учетных данных
    const [existingEmail] = await this.db
      .select({ id: userCredentialsTable.id })
      .from(userCredentialsTable)
      .where(eq(userCredentialsTable.email, cleanedEmail))
      .limit(1);

    if (existingEmail) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Пользователь с таким Email уже существует',
      });
    }

    // 2. Проверяем уникальность никнейма в таблице профилей
    const [existingUsername] = await this.db
      .select({ id: userProfilesTable.id })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.username, formattedUsername))
      .limit(1);

    if (existingUsername) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Этот никнейм уже занят. Выберите другой.',
      });
    }

    const hash = this.hashPassword(password);

    // 3. ОТКРЫВАЕМ ОДНУ ОБЩУЮ ТРАНЗАКЦИЮ НА СОЗДАНИЕ АГРЕГАТА
    const newUser = await this.db.transaction(async (tx) => {
      // А. Создаем корень агрегата в таблице users
      const [insertedUser] = await tx
        .insert(usersTable)
        .values({
          role: 'user',
          status: 'active',
        })
        .returning();

      // Б. Записываем приватные креды
      await tx.insert(userCredentialsTable).values({
        userId: insertedUser.id,
        email: cleanedEmail,
        passwordHash: hash,
      });

      // В. Создаем публичный профиль
      const [insertedProfile] = await tx
        .insert(userProfilesTable)
        .values({
          userId: insertedUser.id,
          username: formattedUsername,
          displayName: displayName?.trim() || null,
        })
        .returning();

      // Г. Выделяем стартовые квоты и лимиты
      await tx.insert(userQuotasTable).values({
        userId: insertedUser.id,
        tier: 'free',
        maxNotes: 1000,
        usedNotes: 0,
        maxStorageMb: 50,
      });

      // Возвращаем собранный объект для генерации JWT токена наружу
      return {
        id: insertedUser.id,
        role: insertedUser.role,
        username: insertedProfile.username,
      };
    });

    return newUser;
  }
}
