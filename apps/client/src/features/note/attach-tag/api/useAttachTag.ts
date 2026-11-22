import { trpc } from '@/shared/api/trpc';

export function useAttachTag() {
  const utils = trpc.useUtils();

  return trpc.tags.attach.useMutation({
    onSuccess: (_data, variables) => {
      utils.notes.getNotes.invalidate();
      utils.tags.list.invalidate();
      if (variables) {
        utils.notes.getById.invalidate({ id: variables.noteId });
      }
    },
    onError: (err) => {
      alert(`Ошибка привязки тега: ${err.message}`);
    },
  });
}
