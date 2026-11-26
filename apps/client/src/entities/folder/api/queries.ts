import { trpc } from '@/shared/api/trpc';

export function useFolders() {
  return trpc.folders.getFolders.useQuery();
}
