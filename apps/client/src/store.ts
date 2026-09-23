import { create } from 'zustand';

export type NotesFilter = 'all' | 'inbox' | 'folder';

interface UIState {
  activeFilter: NotesFilter;
  activeFolderId: string | null;
  activeNoteId: string | null;
  selectedNoteIds: string[];
  targetFolderId: string;
  searchQuery: string;

  setFilter: (filter: NotesFilter) => void;
  setActiveFolder: (folderId: string | null) => void;
  setActiveNote: (noteId: string | null) => void;
  toggleSelectNote: (noteId: string) => void;
  clearSelection: () => void;
  setTargetFolder: (folderId: string) => void;

  setSearchQuery: (inputText: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeFilter: 'all',
  activeFolderId: null,
  activeNoteId: null,
  selectedNoteIds: [],
  targetFolderId: 'inbox',
  searchQuery: '',

  setFilter: (filter) =>
    set({
      activeFilter: filter,
      activeFolderId: null,
      activeNoteId: null,
      selectedNoteIds: [],
    }),
  setActiveFolder: (folderId) =>
    set({
      activeFilter: 'folder',
      activeFolderId: folderId,
      activeNoteId: null,
      selectedNoteIds: [],
    }),
  setActiveNote: (noteId) => set({ activeNoteId: noteId }),
  toggleSelectNote: (noteId) =>
    set((state) => ({
      selectedNoteIds: state.selectedNoteIds.includes(noteId)
        ? state.selectedNoteIds.filter((id) => id !== noteId)
        : [...state.selectedNoteIds, noteId],
    })),
  clearSelection: () => set({ selectedNoteIds: [] }),
  setTargetFolder: (folderId) => set({ targetFolderId: folderId }),

  setSearchQuery: (inputSearchText) => set({ searchQuery: inputSearchText }),
}));
