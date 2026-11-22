import { trpc } from '@/shared/api/trpc';

export function useTags() {
  return trpc.tags.list.useQuery();
}
