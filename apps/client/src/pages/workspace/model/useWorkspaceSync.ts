import { useEffect } from 'react';
import { useNoteFiltersStore } from '@/features/note/filter';
import { useNoteSelectionStore } from '@/features/note/bulk-actions';

export function useWorkspaceSync() {
  useEffect(() => {
    const unsubscribe = useNoteFiltersStore.subscribe((state, prevState) => {
      if (
        state.activeFilter !== prevState.activeFilter ||
        state.activeFolderId !== prevState.activeFolderId ||
        state.activeTagName !== prevState.activeTagName
      ) {
        useNoteSelectionStore.getState().clearSelection();
      }
    });

    return () => unsubscribe();
  }, []);
}
