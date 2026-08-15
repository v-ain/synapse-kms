import Fastify from 'fastify';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { notesRoutes } from './routes/notes.js';
import { foldersRoutes } from './routes/folders.js';
// ( foldersRoutes и tagsRoutes, декомпозировать )
import { ZodError } from 'zod';

const fastify = Fastify({ logger: true });

const queryConnection = postgres(
  'postgres://synapse_kms:secret@localhost:5432/synapse_kms'
);

// 'postgres://synapse_kms:secret@localhost:5432/synapse_kms'
// const sql = postgres('postgres://admin:secret@localhost:5432/synapse_dev');
// const sql = postgres('postgres://postgres:secret@localhost:5432/synapse_kms');

// Создаем типизированный клиент СУБД
const db = drizzle(queryConnection);

// Расширяем типы Fastify, чтобы TypeScript знал про наше новое поле в request
declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

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

// Ловим заголовок авторизации перед каждым запросом!
fastify.addHook('preHandler', async (request, reply) => {
  const userId = request.headers['x-user-id'];

  if (!userId || typeof userId !== 'string') {
    return reply
      .status(401)
      .send({ error: 'Unauthorized. x-user-id header is missing.' });
  }

  // Сохраняем UUID юзера в контекст запроса Fastify
  request.userId = userId;
});

// Регистрируем изолированный плагин роутов заметок
fastify.register(async (instance) => {
  await notesRoutes(instance, db);
  await foldersRoutes(instance, db);
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
