import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config.js';
import { db } from './db.js';
import { FolderService } from './services/folder.service.js';
import { NoteService } from './services/note.service.js';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { appRouter, createContext } from '@synapse-kms/trpc';
import fastifyCookie from '@fastify/cookie';
import { AuthService } from './services/auth.service.js';
import { TagService } from './services/tag.service.js';
import { UserService } from './services/user.service.js';
import { redis } from './infrastructure/redis.js';
import { NoteLockService } from './services/note-lock.service.js';
import { UserRepository } from './domain/user/repository/UserRepository.js';
import { UserContext } from '@synapse-kms/shared';
import { AutoSaveContentUseCase } from './application/note/AutoSaveContentUseCase.js';
import { NoteEventPublisher } from './infrastructure/NoteEventPublisher.js';
import { systemEventBus } from './infrastructure/SystemEventBus.js';

const fastify = Fastify({ logger: true });

await fastify.register(fastifyCookie, {
  secret: process.env.COOKIE_SECRET || 'my-cookie-secret-key-change-me', // для подписи кук при необходимости
});

const noteEventPublisher = new NoteEventPublisher(systemEventBus, 1000);

const userService = new UserService(db);
const authService = new AuthService(db, userService);
const folderService = new FolderService(db, userService);
const tagService = new TagService(db);

const userRepository = new UserRepository(db);
const noteLockService = new NoteLockService(redis, db, noteEventPublisher);
const noteService = new NoteService(
  db,
  noteLockService,
  userRepository,
  noteEventPublisher
);

const autoSaveContentUseCase = new AutoSaveContentUseCase(
  noteService,
  noteLockService,
  noteEventPublisher
);

// Настройки куки: HttpOnly, защита от CSRF через SameSite=Strict, кука живет 7 дней [health]
const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 7, // 7 дней в секундах
};

// apps/server/src/index.ts
await fastify.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  useWss: false,
  trpcOptions: {
    router: appRouter,
    createContext: ({
      req,
      res,
    }: {
      req: FastifyRequest;
      res: FastifyReply;
    }) => {
      // Чистый, нативный Fastify! Плагин @fastify/cookie парсит куки строго сюда
      const token = req.cookies.token;

      let user: UserContext | null = null;

      if (token) {
        const payload = authService.verifyToken(token); // JwtPayload | null, уже валидирован
        if (payload) {
          user = { id: payload.userId, role: payload.userRole };
        }
      }

      // Возвращаем строго по нашему новому интерфейсу
      return createContext({
        redis,
        noteLockService,
        noteService,
        folderService,
        authService,
        tagService,
        userService,
        user,
        // 🚀 Нативное замыкание на метод setCookie от Fastify!
        setAuthCookie: (newToken: string) => {
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
        systemEventBus, // для SSE-подписчиков
        noteEventPublisher, // для use cases / сервисов
        autoSaveContentUseCase,
      });
    },
  },
});

// fastify.get('/tags', async () => {
//   return sql`SELECT id, name FROM tags ORDER BY name ASC;`;
// });

const start = async () => {
  try {
    await fastify.listen({ port: config.serverPort, host: '0.0.0.0' });
    console.log(
      'Сервер Synapse KMS успешно запущен на порту : ' + config.serverPort
    );
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
