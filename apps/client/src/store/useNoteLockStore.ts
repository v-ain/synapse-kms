import { create } from 'zustand';

interface LockState {
  isReadOnly: boolean; // Заблокирован ли инпут для текущего юзера
  lockedByUserId: string | null; // ID того, кто занял замок
  lockedByUserName: string | null; // Имя/Email для красивого плашка-нотификации
  expiresAt: number | null; // Timestamp истечения замка

  // Экшены для синхронизации с tRPC ответами и SSE событиями
  updateLockStatus: (
    currentUserId: string,
    lockInfo: {
      isLocked: boolean;
      lockedBy: string | null;
      lockedByName: string | null;
      expiresAt: number | null;
    }
  ) => void;

  resetLock: () => void;
}

export const useNoteLockStore = create<LockState>((set) => ({
  isReadOnly: false,
  lockedByUserId: null,
  lockedByUserName: null,
  expiresAt: null,

  updateLockStatus: (currentUserId, lockInfo) => {
    // Ключевой предикат: инпут улетает в Read-Only ТОЛЬКО если
    // заметка залочена, и залочена КЕМ-ТО ДРУГИМ (не текущим юзером)
    const isReadOnly = lockInfo.isLocked && lockInfo.lockedBy !== currentUserId;

    set({
      isReadOnly,
      lockedByUserId: lockInfo.lockedBy,
      lockedByUserName: lockInfo.lockedByName,
      expiresAt: lockInfo.expiresAt,
    });
  },

  resetLock: () =>
    set({
      isReadOnly: false,
      lockedByUserId: null,
      lockedByUserName: null,
      expiresAt: null,
    }),
}));
