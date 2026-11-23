import { describe, it, expect, beforeEach } from 'vitest';
import { useNoteFiltersStore } from '../useNoteFiltersStore';

describe('useNoteFiltersStore', () => {
  beforeEach(() => {
    useNoteFiltersStore.setState({
      activeFolderId: null,
      activeFilter: 'all',
      activeTagName: null,
      searchQuery: '',
    });
  });

  it('должен иметь правильные дефолтные значения', () => {
    const state = useNoteFiltersStore.getState();
    expect(state.activeFilter).toBe('all');
    expect(state.activeFolderId).toBeNull();
  });

  it('должен корректно изменять активный фильтр', () => {
    const store = useNoteFiltersStore.getState();

    store.setFilter('archive');

    expect(useNoteFiltersStore.getState().activeFilter).toBe('archive');
  });

  it('должен сбрасывать активную папку при переключении на глобальный фильтр', () => {
    const store = useNoteFiltersStore.getState();

    // Имитируем, что юзер сидел в папке
    store.setActiveFolder('some-folder-uuid');
    expect(useNoteFiltersStore.getState().activeFilter).toBe('folder');

    // Юзер кликает на "Все заметки"
    store.setFilter('all');

    const updatedState = useNoteFiltersStore.getState();
    expect(updatedState.activeFilter).toBe('all');
    expect(updatedState.activeFolderId).toBeNull();
  });
});
