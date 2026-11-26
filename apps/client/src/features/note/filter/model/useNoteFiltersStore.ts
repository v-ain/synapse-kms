import type { NotesFilter } from '@synapse-kms/shared';
import { create } from 'zustand';
import { useActiveNoteStore } from '@/entities/note';

interface NoteFiltersState {
  activeFilter: NotesFilter;
  activeFolderId: string | null;
  activeTagName: string | null;
  searchQuery: string;

  setFilter: (filter: NotesFilter) => void;
  setActiveFolder: (folderId: string | null) => void;
  setActiveTag: (tagName: string | null) => void;
  setSearchQuery: (inputText: string) => void;
}

export const useNoteFiltersStore = create<NoteFiltersState>((set) => ({
  activeFilter: 'all',
  activeFolderId: null,
  activeTagName: null,
  searchQuery: '',

  // Системные фильтры ('all', 'inbox') сбрасывают и папки, и теги
  setFilter: (filter) => {
    set({
      activeFilter: filter,
      activeFolderId: null,
      activeTagName: null,
    });
    useActiveNoteStore.getState().setActiveNote(null);
  },

  // Выбор папки принудительно сбрасывает активный тег
  setActiveFolder: (folderId) => {
    set({
      activeFilter: 'folder',
      activeFolderId: folderId,
      activeTagName: null,
    });
    useActiveNoteStore.getState().setActiveNote(null);
  },

  // Выбор тега принудительно сбрасывает активную папку
  setActiveTag: (tagName) => {
    set({
      activeFilter: 'tag',
      activeFolderId: null,
      activeTagName: tagName,
    });
    useActiveNoteStore.getState().setActiveNote(null);
  },

  setSearchQuery: (inputSearchText) => set({ searchQuery: inputSearchText }),
}));
