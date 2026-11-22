import { trpc } from '@/shared/api/trpc';

export function useUsersForShare(enabled = true) {
  return trpc.users.getAllForShare.useQuery(undefined, { enabled });
}
