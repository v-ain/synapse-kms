import { create } from 'zustand';

interface AuthState {
  userId: string | null;
  email: string | null;
  isAuthed: boolean;
  role: string | null;
  isInitializing: boolean;
  setProfile: (profile: { id: string; email: string; role: string }) => void;
  clearProfile: () => void;
  setInitializing: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  email: null,
  isAuthed: false,
  role: null,
  isInitializing: true, // Флаг первой проверки сессии по кукам

  setProfile: (profile) =>
    set({
      userId: profile.id,
      email: profile.email,
      isAuthed: true,
      role: profile.role,
      isInitializing: false,
    }),

  clearProfile: () =>
    set({
      userId: null,
      email: null,
      isAuthed: false,
      role: null,
      isInitializing: false,
    }),

  setInitializing: (val) => set({ isInitializing: val }),
}));
