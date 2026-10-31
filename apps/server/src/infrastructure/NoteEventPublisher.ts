import {
  LockUpdatedEvent,
  NoteMutatedEvent,
  SYSTEM_EVENTS,
} from '@synapse-kms/shared';
import type { EventEmitter } from 'node:events';

type DebounceEntry = {
  timer: NodeJS.Timeout;
  payload: NoteMutatedEvent & { type: 'UPDATED' };
};

export class NoteEventPublisher {
  private readonly pending = new Map<string, DebounceEntry>();

  constructor(
    private readonly emitter: EventEmitter,
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

    const payload = {
      type: 'UPDATED' as const,
      noteId,
      origin: 'autoSave' as const,
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

  lockUpdated(noteId: string, event: Omit<LockUpdatedEvent, 'noteId'>) {
    this.emitter.emit(SYSTEM_EVENTS.LOCK_UPDATED, { noteId, ...event });
  }

  // ── private ──────────────────────────────────────────────────

  private emitNote(payload: NoteMutatedEvent) {
    this.emitter.emit(SYSTEM_EVENTS.NOTE_MUTATED, payload);
  }
}
