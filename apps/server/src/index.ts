import Fastify from 'fastify';
import postgres from 'postgres';
import { notesRoutes } from './routes/notes.js';
import { foldersRoutes } from './routes/folders.js';
// ( foldersRoutes и tagsRoutes, декомпозировать )

const fastify = Fastify({ logger: true });
const sql = postgres('postgres://admin:secret@localhost:5432/synapse_dev');
// const sql = postgres('postgres://postgres:secret@localhost:5432/synapse_kms');

// Регистрируем изолированный плагин роутов заметок
fastify.register(async (instance) => {
  await notesRoutes(instance, sql);
  await foldersRoutes(instance, sql);
});

fastify.get('/tags', async () => {
  return sql`SELECT id, name FROM tags ORDER BY name ASC;`;
});

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
