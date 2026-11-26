import { trpc } from '@/shared/api/trpc';

export function useCreateNote() {
  const utils = trpc.useUtils();

  return trpc.notes.create.useMutation({
    onSuccess: () => {
      utils.folders.invalidate();
      utils.notes.getNotes.invalidate();
    },
  });
}
