import { trpc } from '@/shared/api/trpc';
import { useActiveNoteStore } from '@/entities/note';
import { toast } from 'sonner';

export function useArchiveNote() {
  const utils = trpc.useUtils();

  return trpc.notes.archive.useMutation({
    onSuccess: () => {
      useActiveNoteStore.getState().setActiveNote(null);
      utils.notes.getNotes.invalidate();
      toast.success('Заметка перемещена в архив');
    },
  });
}
