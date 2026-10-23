import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { usersTable } from '@synapse-kms/shared';
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

  async validateUser(email: string, password: string) {
    // Вся логика поиска теперь изолирована в одном месте
    const user = await this.userService.findByEmail(email);
    if (!user) return null;

    const isPasswordValid = this.verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) return null;

    return { id: user.id, role: user.role, username: user.username };
  }

  async registerUser(input: RegisterUserInput) {
    const { email, password, username, displayName } = input;

    const cleanedEmail = email.trim().toLowerCase();
    // Бизнес-валидация: очищаем никнейм и гарантируем префикс @
    const formattedUsername = `@${username.replace(/^@/, '').trim().toLowerCase()}`;

    // 1. Проверяем, существует ли уже пользователь с таким Email
    const existingUser = await this.userService.findByEmail(cleanedEmail);
    if (existingUser) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Пользователь с таким Email уже существует',
      });
    }

    // 2. Проверяем уникальность никнейма в базе данных
    const [existingWithUsername] = await this.db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, formattedUsername))
      .limit(1);

    if (existingWithUsername) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Этот никнейм уже занят. Выберите другой.',
      });
    }

    // 3. Хешируем пароль надежным методом
    const hash = this.hashPassword(password);

    // 4. ВСТАВЛЯЕМ ПОЛНОЦЕННЫЙ DDD-ПАКЕТ ДАННЫХ
    const [newUser] = await this.db
      .insert(usersTable)
      .values({
        email: cleanedEmail,
        passwordHash: hash,
        role: 'user',

        // Заполняем профиль
        username: formattedUsername,
        displayName: displayName?.trim() || null,

        // Выделяем дефолтные стартовые лимиты
        tier: 'free',
        maxNotes: 1000, // Жесткий лимит на бесплатном тарифе
        usedNotes: 0, // Стартуем с чистого листа
      })
      .returning();

    if (!newUser) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Не удалось создать аккаунт. Ошибка СУБД.',
      });
    }

    return newUser;
  }
}
