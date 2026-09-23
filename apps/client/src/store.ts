import type { NotesFilter } from '@synapse-kms/shared';
import { create } from 'zustand';

interface UIState {
  activeFilter: NotesFilter;
  activeFolderId: string | null;
  activeTagName: string | null;
  activeNoteId: string | null;
  selectedNoteIds: string[];
  targetFolderId: string;
  searchQuery: string;

  setFilter: (filter: NotesFilter) => void;
  setActiveFolder: (folderId: string | null) => void;
  setActiveTag: (tagName: string | null) => void;
  setActiveNote: (noteId: string | null) => void;
  toggleSelectNote: (noteId: string) => void;
  clearSelection: () => void;
  setTargetFolder: (folderId: string) => void;
  setSearchQuery: (inputText: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeFilter: 'all',
  activeFolderId: null,
  activeTagName: null,
  activeNoteId: null,
  selectedNoteIds: [],
  targetFolderId: 'inbox',
  searchQuery: '',

  // Системные фильтры ('all', 'inbox') сбрасывают и папки, и теги
  setFilter: (filter) =>
    set({
      activeFilter: filter,
      activeFolderId: null,
      activeTagName: null,
      activeNoteId: null,
      selectedNoteIds: [],
    }),

  // Выбор папки принудительно сбрасывает активный тег
  setActiveFolder: (folderId) =>
    set({
      activeFilter: 'folder',
      activeFolderId: folderId,
      activeTagName: null,
      activeNoteId: null,
      selectedNoteIds: [],
    }),

  // Выбор тега принудительно сбрасывает активную папку
  setActiveTag: (tagName) =>
    set({
      activeFilter: 'tag',
      activeFolderId: null,
      activeTagName: tagName,
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
