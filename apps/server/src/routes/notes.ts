import { FastifyInstance } from 'fastify';
import { NotesController } from '../controllers/notes.js';

import type {
  NotesFilter,
  BulkMovePayload,
  CreateNotePayload,
  GetNotesQueryParams,
} from '@synapse-kms/shared'; // Наш строгий импорт типов!

export async function notesRoutes(fastify: FastifyInstance, sql: any) {
  // Инициализируем контроллер, передавая ему инстанс базы и логгер
  const controller = new NotesController(sql, fastify.log);

  fastify.get<{ Querystring: GetNotesQueryParams }>(
    '/notes',
    async (request, reply) => {
      return controller.getNotes(request.query);
    }
  );

  // Создание новой заметки (таска)
  fastify.post<{ Body: CreateNotePayload }>(
    '/notes',
    async (request, reply) => {
      const { title, content, folder_id } = request.body;

      if (!title || title.trim().length === 0) {
        return reply.status(400).send({ error: 'Title is required' });
      }

      const newNote = await controller.createNote(request.body);
      return reply.status(201).send(newNote);
    }
  );

  // Точечный контент заметки O(1)
  fastify.get<{ Params: { id: string } }>(
    '/notes/:id',
    async (request, reply) => {
      const note = await controller.getNoteById(request.params.id);
      if (!note) return reply.status(404).send({ error: 'Note not found' });
      return note;
    }
  );

  // Пакетное перемещение с проверкой версий (наш оптимистичный замок)
  fastify.post<{ Body: BulkMovePayload }>(
    '/notes/bulk-move',
    async (request, reply) => {
      const result = await controller.bulkMove(request.body);
      if (result.conflict) {
        return reply
          .status(409)
          .send({ error: 'Conflict! Note version mismatch.' });
      }
      return { success: true };
    }
  );

  // Мягкое удаление (Архивация)
  fastify.patch<{ Params: { id: string } }>(
    '/notes/:id/archive',
    async (request, reply) => {
      const result = await controller.archiveNote(request.params.id);
      if (result.error)
        return reply.status(result.status).send({ error: result.error });
      return { success: true };
    }
  );

  // Привязка тега по имени (наш смарт-роут с ON CONFLICT)
  fastify.post<{ Body: { note_id: string; tag_name: string } }>(
    '/notes/attach-tag',
    async (request, reply) => {
      return controller.attachTag(request.body.note_id, request.body.tag_name);
    }
  );
}
