import { create } from 'zustand';

interface ActiveNoteState {
  activeNoteId: string | null;
  setActiveNote: (noteId: string | null) => void;
}

export const useActiveNoteStore = create<ActiveNoteState>((set) => ({
  activeNoteId: null,
  setActiveNote: (noteId) => set({ activeNoteId: noteId }),
}));
