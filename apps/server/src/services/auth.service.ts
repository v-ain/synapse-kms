import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { usersTable } from '@synapse-kms/shared';

const JWT_SECRET =
  process.env.JWT_SECRET || 'super-secret-key-change-me-in-production';

export class AuthService {
  constructor(private db: PostgresJsDatabase<any>) {}
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
  generateToken(userId: string): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
  }

  // 4. Валидация JWT токена
  verifyToken(token: string): { userId: string } | null {
    try {
      return jwt.verify(token, JWT_SECRET) as { userId: string };
    } catch {
      return null;
    }
  }

  async validateUser(email: string, password: string) {
    const [user] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.trim().toLowerCase()));

    if (!user) return null;

    const isPasswordValid = this.verifyPassword(password, user.password_hash);
    if (!isPasswordValid) return null;

    return user;
  }

  // 🏗️ Метод создания пользователя для регистрации
  async registerUser(email: string, password: string) {
    const passwordHash = this.hashPassword(password);

    const [newUser] = await this.db
      .insert(usersTable)
      .values({
        email: email.trim().toLowerCase(),
        password_hash: passwordHash,
      })
      .returning();

    return newUser;
  }
}
