import { trpc } from '@/shared/api/trpc';

interface UseDeleteFolderOptions {
  onDeleted?: () => void;
}

export function useDeleteFolder(options?: UseDeleteFolderOptions) {
  const utils = trpc.useUtils();

  const mutation = trpc.folders.delete.useMutation({
    onSuccess: () => {
      // Коллбэк снаружи (из виджета), чтобы не тащить сюда стор из features/note/filter
      options?.onDeleted?.();
      utils.folders.getFolders.invalidate();
      utils.notes.getNotes.invalidate();
    },
    onError: (error) => {
      alert(error.message || 'Не удалось удалить папку.');
    },
  });

  const deleteFolder = (id: string) => {
    return mutation.mutate({
      id,
      clientUpdatedAt: new Date().toISOString(),
    });
  };

  return { ...mutation, deleteFolder };
}
