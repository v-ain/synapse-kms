import { useActiveNoteStore } from '@/entities/note';
import { useNoteFiltersStore } from '@/features/note/filter';
import { useNoteSelectionStore } from '@/features/note/bulk-actions';

// Синхронизация: при смене фильтра/папки/тега сбрасываем массовое выделение
// (Потом перенесешь эту подписку в widgets/notes-sidebar или app/providers)
useNoteFiltersStore.subscribe((state, prevState) => {
  if (
    state.activeFilter !== prevState.activeFilter ||
    state.activeFolderId !== prevState.activeFolderId ||
    state.activeTagName !== prevState.activeTagName
  ) {
    useNoteSelectionStore.getState().clearSelection();
  }
});

// Временный фасад для обратной совместимости со старыми компонентами и тестами
export function useUIStore() {
  const activeNote = useActiveNoteStore();
  const filters = useNoteFiltersStore();
  const selection = useNoteSelectionStore();

  return {
    ...activeNote,
    ...filters,
    ...selection,
  };
}
