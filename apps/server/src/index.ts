import Fastify from 'fastify';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ZodError } from 'zod';
import { FolderService } from './services/folder.service.js';
import { NoteService } from './services/note.service.js';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter, createContext } from '@synapse-kms/trpc';
import fastifyCookie from '@fastify/cookie';
import { AuthService } from './services/auth.service.js';
import { TagService } from './services/tag.service.js';
import { AdminService } from './services/admin.service.js';

const fastify = Fastify({ logger: true });

const queryConnection = postgres(
  'postgres://myuser:mypassword@localhost:5432/mydb'
);

// Создаем типизированный клиент СУБД
const db = drizzle(queryConnection);

// Расширяем типы Fastify, чтобы TypeScript знал про наше новое поле в request
declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

const noteService = new NoteService(db);
const folderService = new FolderService(db);

// ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ОШИБОК ВАЛИДАЦИИ
fastify.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    // Если ошибку выкинул Zod — отдаем честный 400 Bad Request
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Ошибка валидации входящих данных',
      // Разворачиваем подробный список: какое именно поле и почему не прошло проверку
      issues: error.errors.map((err) => ({
        field: err.path.join('.'),
        issue: err.message,
      })),
    });
  }

  // Для всех остальных системных ошибок оставляем дефолтное поведение
  reply.send(error);
});

await fastify.register(fastifyCookie, {
  secret: process.env.COOKIE_SECRET || 'my-cookie-secret-key-change-me', // для подписи кук при необходимости
});

const authService = new AuthService(db);
const tagService = new TagService(db);
const adminService = new AdminService(db);

// Настройки куки: HttpOnly, защита от CSRF через SameSite=Strict, кука живет 7 дней [health]
const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: false,
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 7, // 7 дней в секундах
};

// apps/server/src/index.ts

await fastify.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  useWss: false,
  trpcOptions: {
    router: appRouter,
    createContext: ({ req, res }) => {
      // Чистый, нативный Fastify! Плагин @fastify/cookie парсит куки строго сюда
      const token = req.cookies.token;
      let userId: string | null = null;
      let userRole: string | null = null;

      if (token) {
        const payload = authService.verifyToken(token);
        if (payload) {
          userId = payload.userId;
          userRole = payload.userRole;
        }
      }

      // Возвращаем строго по нашему новому интерфейсу
      return createContext({
        noteService,
        folderService,
        authService,
        tagService,
        adminService,
        userId,
        userRole,
        // 🚀 Нативное замыкание на метод setCookie от Fastify!
        setAuthCookie: (newToken) => {
          if (newToken === '') {
            res.setCookie('token', '', {
              ...COOKIE_OPTIONS,
              maxAge: 0,
              path: '/',
            });
          } else {
            res.setCookie('token', newToken, { ...COOKIE_OPTIONS, path: '/' });
          }
        },
      });
    },
  },
});

// fastify.get('/tags', async () => {
//   return sql`SELECT id, name FROM tags ORDER BY name ASC;`;
// });

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('🚀 Бронебойный сервер Synapse KMS запущен на порту 3000!');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();

export type { NoteService } from './services/note.service.js';
export type { FolderService } from './services/folder.service.js';
export type { AuthService } from './services/auth.service.js';
export type { TagService } from './services/tag.service.js';
