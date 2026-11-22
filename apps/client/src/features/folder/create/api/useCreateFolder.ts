import { trpc } from '@/shared/api/trpc';

export function useCreateFolder() {
  const utils = trpc.useUtils();

  return trpc.folders.create.useMutation({
    onSuccess: (newFolder) => {
      utils.folders.getFolders.setData(undefined, (oldFolders) => {
        if (!oldFolders) return [newFolder];
        return [newFolder, ...oldFolders];
      });
    },
  });
}
