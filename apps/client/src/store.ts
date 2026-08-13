import { create } from 'zustand';

export type NotesFilter = 'all' | 'inbox' | 'folder';

interface UIState {
  activeFilter: NotesFilter;
  activeFolderId: string | null;
  activeNoteId: string | null;

  // ГЛОБАЛЬНЫЙ СТЕЙТ ДЛЯ МАССОВЫХ ОПЕРАЦИЙ
  selectedNoteIds: string[];
  targetFolderId: string; // 'inbox' или UUID папки

  // Экшены навигации
  setFilter: (filter: NotesFilter) => void;
  setActiveFolder: (folderId: string | null) => void;
  setActiveNote: (noteId: string | null) => void;

  // ЭКШЕНЫ ДЛЯ ЧЕК-БОКСОВ
  toggleSelectNote: (noteId: string) => void;
  clearSelection: () => void;
  setTargetFolder: (folderId: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeFilter: 'all',
  activeFolderId: null,
  activeNoteId: null,

  selectedNoteIds: [],
  targetFolderId: 'inbox',

  setFilter: (filter) =>
    set({
      activeFilter: filter,
      activeFolderId: null,
      activeNoteId: null,
      selectedNoteIds: [], // 🧼 Чистим галочки при переключении вкладок!
    }),

  setActiveFolder: (folderId) =>
    set({
      activeFilter: 'folder',
      activeFolderId: folderId,
      activeNoteId: null,
      selectedNoteIds: [], // 🧼 Чистим галочки при смене папки!
    }),

  setActiveNote: (noteId) => set({ activeNoteId: noteId }),

  // 🎯 Реализация экшенов для чекбоксов
  toggleSelectNote: (noteId) =>
    set((state) => ({
      selectedNoteIds: state.selectedNoteIds.includes(noteId)
        ? state.selectedNoteIds.filter((id) => id !== noteId)
        : [...state.selectedNoteIds, noteId],
    })),

  clearSelection: () => set({ selectedNoteIds: [] }),
  setTargetFolder: (folderId) => set({ targetFolderId: folderId }),
}));
