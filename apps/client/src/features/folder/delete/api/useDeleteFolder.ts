import { trpc } from '@/shared/api/trpc';
import { toast } from 'sonner';

interface UseDeleteFolderOptions {
  onDeleted?: () => void;
}

export function useDeleteFolder(options?: UseDeleteFolderOptions) {
  const utils = trpc.useUtils();

  const mutation = trpc.folders.delete.useMutation({
    onSuccess: () => {
      options?.onDeleted?.();
      utils.folders.getFolders.invalidate();
      utils.notes.getNotes.invalidate();
      toast.success('Папка удалена');
    },
  });

  const deleteFolder = (id: string) => {
    mutation.mutate({
      id,
      clientUpdatedAt: new Date().toISOString(),
    });
  };
  return { ...mutation, deleteFolder };

  // return {
  //   deleteFolder,
  //   isPending: mutation.isPending,
  // };
}
