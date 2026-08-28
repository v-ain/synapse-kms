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

await fastify.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  useWss: false,
  trpcOptions: {
    router: appRouter,
    createContext: ({ req, res }) => {
      // 🪄 Вытаскиваем токен прямо из кук запроса
      const token = req.cookies.token;
      let userId: string | null = null;

      if (token) {
        // Проверяем валидность JWT токена через наш сервис
        const payload = authService.verifyToken(token);
        if (payload) {
          userId = payload.userId;
        }
      }

      // Собираем полный контекст
      return createContext({
        noteService,
        folderService,
        authService, // передаем инстанс сервиса авторизации
        tagService,
        userId, // теперь здесь либо строка UUID, либо null (если гость)
        res, // Передаем res Fastify в tRPC контекст!
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
