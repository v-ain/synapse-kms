// server/src/infrastructure/events/system-events.types.ts

// ── Доменные пейлоады ────────────────────────────────────────

export type NoteMutatedPayload =
  | {
      type: 'CREATED';
      noteId: string;
      folderId: string | null;
      actorUserId: string;
    }
  | {
      type: 'UPDATED';
      noteId: string;
      origin: 'autoSave' | 'updateMeta';
      actorUserId: string;
    }
  | { type: 'DELETED'; noteId: string; actorUserId: string };

export type LockUpdatedPayload = {
  type: 'ACQUIRED' | 'RENEWED' | 'RELEASED';
  noteId: string;
  lock: {
    isLocked: boolean;
    lockedBy: string | null;
    lockedByName: string | null;
    expiresAt: number | null;
  } | null;
  actorUserId: string;
};

// ── Системные события: дискриминированный юнион ──────────────

export type SystemEvent =
  | { type: 'NOTE_MUTATED'; payload: NoteMutatedPayload }
  | { type: 'LOCK_UPDATED'; payload: LockUpdatedPayload };
// сюда добавляешь FOLDER_UPDATED, TAG_MUTATED и т.д.

export type SystemEventType = SystemEvent['type'];

// Утилита: пейлоад по типу события (для клиента)
export type PayloadOf<T extends SystemEventType> = Extract<
  SystemEvent,
  { type: T }
>['payload'];
