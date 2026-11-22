import { trpc } from '@/shared/api/trpc';
import { useActiveNoteStore } from '@/entities/note';

export function useArchiveNote() {
  const utils = trpc.useUtils();

  return trpc.notes.archive.useMutation({
    onSuccess: () => {
      // Фича легально вызывает стор сущности
      useActiveNoteStore.getState().setActiveNote(null);
      utils.notes.getNotes.invalidate();
    },
  });
}
