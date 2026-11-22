import { trpc } from '@/shared/api/trpc';

export function useShareFolder() {
  const utils = trpc.useUtils();

  return trpc.folders.shareFolder.useMutation({
    onSuccess: () => {
      utils.folders.getFolders.invalidate();
    },
    onError: (error) => {
      alert(`Ошибка синхронизации прав: ${error.message}`);
    },
  });
}
