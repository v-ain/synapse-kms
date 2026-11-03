import { LockUpdatedPayload, NoteMutatedPayload } from '@synapse-kms/shared';
import { type SystemEventBus } from './SystemEventBus.js';

type DebounceEntry = {
  timer: NodeJS.Timeout;
  payload: NoteMutatedPayload;
  // payload: NoteMutatedEvent & { type: 'UPDATED' };
};

export class NoteEventPublisher {
  private readonly pending = new Map<string, DebounceEntry>();

  constructor(
    private readonly systemEventBus: SystemEventBus,
    private readonly debounceMs = 1000
  ) {}

  // ── NOTE_MUTATED ──────────────────────────────────────────────

  noteCreated(noteId: string, folderId: string | null, actorUserId: string) {
    this.emitNote({ type: 'CREATED', noteId, folderId, actorUserId });
  }

  noteDeleted(noteId: string, actorUserId: string) {
    this.emitNote({ type: 'DELETED', noteId, actorUserId });
  }

  /**
   * autoSave — debounce 1с trailing. Схлопывает поток событий при вводе.
   */
  noteUpdatedAutoSave(noteId: string, actorUserId: string) {
    const key = `autoSave:${noteId}`;
    const existing = this.pending.get(key);
    if (existing) clearTimeout(existing.timer);

    const payload: NoteMutatedPayload = {
      type: 'UPDATED',
      noteId,
      origin: 'autoSave',
      actorUserId,
    };

    this.pending.set(key, {
      payload,
      timer: setTimeout(() => {
        this.pending.delete(key);
        this.emitNote(payload);
      }, this.debounceMs),
    });
  }

  /**
   * updateMeta — flush немедленно (заголовок виден в списке сразу).
   * Если для этой заметки висит debounce от autoSave — сначала флашим его,
   * чтобы события не переупорядочились.
   */
  noteUpdatedMeta(noteId: string, actorUserId: string) {
    this.flush(noteId);
    this.emitNote({
      type: 'UPDATED',
      noteId,
      origin: 'updateMeta',
      actorUserId,
    });
  }

  /**
   * Принудительно доставить отложенное autoSave-событие (если есть).
   */
  flush(noteId: string) {
    const key = `autoSave:${noteId}`;
    const entry = this.pending.get(key);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(key);
    this.emitNote(entry.payload);
  }

  // ── LOCK_UPDATED ─────────────────────────────────────────────

  lockUpdated(payload: LockUpdatedPayload) {
    this.systemEventBus.publish({ type: 'LOCK_UPDATED', payload });
  }

  // ── private ──────────────────────────────────────────────────

  private emitNote(payload: NoteMutatedPayload) {
    this.systemEventBus.publish({ type: 'NOTE_MUTATED', payload });
  }
}
