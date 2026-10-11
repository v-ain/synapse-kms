import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { usersTable } from '@synapse-kms/shared';
import { DrizzleDB } from '../db.js';
import type { UserService } from './user.service.js';

const JWT_SECRET =
  process.env.JWT_SECRET || 'super-secret-key-change-me-in-production';

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

    return { id: user.id, role: user.role };
  }

  async registerUser(email: string, password: string) {
    const existingUser = await this.userService.findByEmail(email);
    if (existingUser)
      throw new Error('Пользователь с таким Email уже существует');

    const hash = this.hashPassword(password);

    // Мутации (INSERT) по-прежнему делаем через Core API внутри Auth
    const [newUser] = await this.db
      .insert(usersTable)
      .values({
        email: email.trim().toLowerCase(),
        passwordHash: hash,
      })
      .returning();

    return newUser;
  }
}
