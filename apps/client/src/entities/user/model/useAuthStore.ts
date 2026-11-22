import { create } from 'zustand';

export interface AuthProfile {
  id: string;
  username: string;
  displayName?: string | null;
  role: string;
}

interface AuthState {
  userId: string | null;
  username: string | null;
  displayName: string | null;
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
  isAuthed: false,
  role: null,
  isInitializing: true,

  setProfile: (profile) =>
    set({
      userId: profile.id,
      username: profile.username,
      displayName: profile.displayName || null,
      isAuthed: true,
      role: profile.role,
      isInitializing: false,
    }),

  clearProfile: () =>
    set({
      userId: null,
      username: null,
      displayName: null,
      isAuthed: false,
      role: null,
      isInitializing: false,
    }),

  setInitializing: (val) => set({ isInitializing: val }),
}));
