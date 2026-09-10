import { trpc } from '@/utils/trpc';

export function useAdminNotes() {
  return trpc.admin.getNotes.useInfiniteQuery(
    {
      folder_id: undefined,
      limit: '20',
      search: undefined, // 🔍 Передаем поиск в tRPC!
    },
    {
      initialCursor: undefined,
      getNextPageParam: (lastPage) => lastPage.next_cursor || undefined,
    }
  );
}
