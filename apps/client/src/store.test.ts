import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from './store';

describe('Zustand UI Store', () => {
  // Перед каждым тестом сбрасываем состояние стора в дефолтное,
  // чтобы тесты не влияли друг на друга (изоляция данных)
  beforeEach(() => {
    useUIStore.setState({
      activeFolderId: null,
      activeFilter: 'all',
    });
  });

  it('должен иметь правильные дефолтные значения', () => {
    const state = useUIStore.getState();
    expect(state.activeFilter).toBe('all');
    expect(state.activeFolderId).toBeNull();
  });

  it('должен корректно изменять активный фильтр', () => {
    const store = useUIStore.getState();

    store.setFilter('archive');

    expect(useUIStore.getState().activeFilter).toBe('archive');
  });

  it('должен сбрасывать активную папку при переключении на глобальный фильтр', () => {
    const store = useUIStore.getState();

    // Имитируем, что юзер сидел в папке
    store.setFilter('folder');
    store.setActiveFolder('some-folder-uuid');

    // Юзер кликает на "Все заметки"
    store.setFilter('all');

    const updatedState = useUIStore.getState();
    expect(updatedState.activeFilter).toBe('all');
    expect(updatedState.activeFolderId).toBeNull(); // 👈 Очистился! Логика работает
  });
});
