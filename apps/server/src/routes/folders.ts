import { FastifyInstance } from 'fastify';
import { FoldersController } from '../controllers/folders.js';

export async function foldersRoutes(fastify: FastifyInstance, sql: any) {
  const controller = new FoldersController(sql, fastify.log);

  fastify.get('/folders', async (request) => {
    return controller.getFolders(request.userId); // 🎯 Прокинули!
  });

  fastify.post<{ Body: { title: string } }>('/folders', async (request) => {
    return controller.createFolder(request.body.title, request.userId); // 🎯 Прокинули!
  });

  fastify.delete<{ Params: { id: string } }>(
    '/folders/:id',
    async (request) => {
      await controller.deleteFolder(request.params.id, request.userId);
      return { success: true };
    }
  );
}
