import { create } from 'zustand';

interface NoteSelectionState {
  selectedNoteIds: string[];
  targetFolderId: string;

  toggleSelectNote: (noteId: string) => void;
  clearSelection: () => void;
  setTargetFolder: (folderId: string) => void;
}

export const useNoteSelectionStore = create<NoteSelectionState>((set) => ({
  selectedNoteIds: [],
  targetFolderId: 'inbox',

  toggleSelectNote: (noteId) =>
    set((state) => ({
      selectedNoteIds: state.selectedNoteIds.includes(noteId)
        ? state.selectedNoteIds.filter((id) => id !== noteId)
        : [...state.selectedNoteIds, noteId],
    })),

  clearSelection: () => set({ selectedNoteIds: [] }),
  setTargetFolder: (folderId) => set({ targetFolderId: folderId }),
}));
