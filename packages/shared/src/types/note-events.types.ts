export type NoteUpdatedOrigin = 'autoSave' | 'updateMeta';

export type NoteMutatedEvent =
  | {
      type: 'CREATED';
      noteId: string;
      folderId: string | null;
      actorUserId: string;
    }
  | {
      type: 'UPDATED';
      noteId: string;
      origin: NoteUpdatedOrigin;
      actorUserId: string;
    }
  | { type: 'DELETED'; noteId: string; actorUserId: string };

export type LockUpdatedEvent = {
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

export type SystemEventMap = {
  NOTE_MUTATED: NoteMutatedEvent;
  LOCK_UPDATED: LockUpdatedEvent;
};

export const SYSTEM_EVENTS = {
  NOTE_MUTATED: 'NOTE_MUTATED',
  LOCK_UPDATED: 'LOCK_UPDATED',
} as const satisfies Record<keyof SystemEventMap, keyof SystemEventMap>;
