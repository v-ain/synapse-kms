import { TRPCError } from '@trpc/server';
import type { NoteService } from '../../services/note.service.js';
import type { NoteLockService } from '../../services/note-lock.service.js';
import { AutoSaveNotePayload, NoteWriteResult } from '@synapse-kms/shared';
import { NoteEventPublisher } from 'src/infrastructure/NoteEventPublisher.js';

export class AutoSaveContentUseCase {
  constructor(
    private readonly noteService: NoteService,
    private readonly noteLockService: NoteLockService,
    private readonly events: NoteEventPublisher
  ) {}

  async execute(
    payload: AutoSaveNotePayload,
    actorUserId: string,
    accessLevel: 'read' | 'write' | 'owner'
  ): Promise<NoteWriteResult> {
    // 1. Политика: права
    if (accessLevel === 'read') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'У вас есть права только на чтение заметок в этой папке',
      });
    }

    // 2. Политика: лок
    const isLocked = await this.noteLockService.isLockedByOthers(
      payload.noteId,
      actorUserId
    );
    if (isLocked) {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'Заметка заблокирована другим пользователем. Изменения отклонены.',
      });
    }

    // 3. Домен: запись
    const result = await this.noteService.autoSaveContent(payload, actorUserId);

    // 4. События: только при успехе
    if (result.status === 'applied') {
      this.events.noteUpdatedAutoSave(payload.noteId, actorUserId);
    }

    return result;
  }
}
