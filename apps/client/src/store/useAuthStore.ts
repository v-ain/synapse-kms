import { create } from 'zustand';

interface AuthState {
  userId: string | null;
  email: string | null;
  role: string | null;
  isInitialized: boolean;
  setProfile: (profile: { id: string; email: string; role: string }) => void;
  clearProfile: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  email: null,
  role: null,
  isInitialized: false,

  setProfile: (profile) =>
    set({
      userId: profile.id,
      email: profile.email,
      role: profile.role,
      isInitialized: true,
    }),

  clearProfile: () =>
    set({
      userId: null,
      email: null,
      role: null,
      isInitialized: true,
    }),
}));
