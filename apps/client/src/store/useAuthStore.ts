import { create } from 'zustand';

interface AuthProfile {
  id: string;
  username: string; // Новое обязательное поле
  displayName?: string | null; // Опциональное имя
  email?: string | null; // Оставляем для обратной совместимости
  role: string;
}

interface AuthState {
  userId: string | null;
  username: string | null; //
  displayName: string | null; //
  email: string | null; // Старое поле (не ломает существующий код)
  isAuthed: boolean;
  role: string | null;
  isInitializing: boolean;
  setProfile: (profile: AuthProfile) => void;
  clearProfile: () => void;
  setInitializing: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  username: null,
  displayName: null,
  email: null,
  isAuthed: false,
  role: null,
  isInitializing: true,

  setProfile: (profile) =>
    set({
      userId: profile.id,
      username: profile.username,
      displayName: profile.displayName || null,
      // ЛАЙФХАК: Если сервер прислал email — берем его,
      // если нет — фолбэчимся на username, чтобы старый UI не сломался!
      email: profile.email || profile.username,
      isAuthed: true,
      role: profile.role,
      isInitializing: false,
    }),

  clearProfile: () =>
    set({
      userId: null,
      username: null,
      displayName: null,
      email: null,
      isAuthed: false,
      role: null,
      isInitializing: false,
    }),

  setInitializing: (val) => set({ isInitializing: val }),
}));
