import { create } from 'zustand';

// Описываем типы фильтров, которые один в один совпадают с бэкендом
export type NotesFilter = 'all' | 'inbox' | 'folder';

interface UIState {
  activeFolderId: string | null;
  activeNoteId: string | null;
  activeFilter: NotesFilter;

  // Экшены (действия) для изменения состояния
  setActiveFolder: (folderId: string | null) => void;
  setActiveNote: (noteId: string | null) => void;
  setFilter: (filter: NotesFilter) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Дефолтные координаты при старте приложения
  activeFolderId: null,
  activeNoteId: null,
  activeFilter: 'all', // По умолчанию показываем вообще все заметки

  setActiveFolder: (folderId) =>
    set({
      activeFolderId: folderId,
      activeNoteId: null, // Сбрасываем открытую заметку при переходе в другую папку
      activeFilter: folderId ? 'folder' : 'all', // Умное переключение фильтра
    }),

  setActiveNote: (noteId) => set({ activeNoteId: noteId }),

  setFilter: (filter) =>
    set((state) => ({
      activeFilter: filter,
      // Если переключаемся на inbox или all, сбрасываем активную папку
      activeFolderId: filter === 'folder' ? state.activeFolderId : null,
      activeNoteId: null,
    })),
}));
