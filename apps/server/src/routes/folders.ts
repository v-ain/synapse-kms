import { FastifyInstance } from 'fastify';
import { FoldersController } from '../controllers/folders.js';

export async function foldersRoutes(fastify: FastifyInstance, sql: any) {
  const controller = new FoldersController(sql, fastify.log);

  // Получить список всех папок
  fastify.get('/folders', async (request, reply) => {
    return controller.getFolders();
  });

  // Создать новую папку
  fastify.post<{ Body: { title: string } }>(
    '/folders',
    async (request, reply) => {
      const { title } = request.body;

      if (!title || title.trim().length === 0) {
        return reply.status(400).send({ error: 'Folder title is required' });
      }

      const newFolder = await controller.createFolder(title);
      return reply.status(201).send(newFolder);
    }
  );

  // Удалить папку каскадом (наша логика использования!)
  fastify.delete<{ Params: { id: string } }>(
    '/folders/:id',
    async (request, reply) => {
      await controller.deleteFolder(request.params.id);
      return {
        success: true,
        message: 'Folder deleted, notes moved to inbox.',
      };
    }
  );
}
