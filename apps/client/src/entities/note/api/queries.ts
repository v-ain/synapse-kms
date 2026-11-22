import { NOTES_PAGE_SIZE, type NotesFilter } from '@synapse-kms/shared';
import { trpc } from '@/shared/api/trpc';

export interface UseNotesParams {
  filter: NotesFilter;
  folderId?: string | null;
  tagName?: string | null;
  search?: string;
}

export function useNotes({
  filter,
  folderId,
  tagName,
  search = '',
}: UseNotesParams) {
  const normalizedFolderId =
    filter === 'folder' ? (folderId ?? undefined) : undefined;
  const normalizedTagName =
    filter === 'tag' ? (tagName ?? undefined) : undefined;

  return trpc.notes.getNotes.useInfiniteQuery(
    {
      filter,
      folderId: normalizedFolderId,
      tagName: normalizedTagName,
      search,
      limit: NOTES_PAGE_SIZE,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );
}

export function useNote(id: string) {
  return trpc.notes.getById.useQuery({ id }, { refetchOnMount: 'always' });
}
