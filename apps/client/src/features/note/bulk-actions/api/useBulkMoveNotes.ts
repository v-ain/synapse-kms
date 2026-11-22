import { trpc } from '@/shared/api/trpc';

export function useBulkMoveNotes() {
  const utils = trpc.useUtils();

  const mutation = trpc.notes.bulkMove.useMutation({
    onSuccess: (result) => {
      utils.folders.getFolders.invalidate();
      utils.notes.getNotes.invalidate();

      if (result.movedIds.length === 0) {
        console.warn(
          'Ни одна из заметок не была перемещена, так как данные в базе новее.'
        );
      }
    },
    onError: (error) => {
      alert(error.message || 'Что-то пошло не так при перемещении...');
    },
  });

  const bulkMove = (
    payload: { targetFolderId: string | null; ids: string[] },
    options?: any
  ) => {
    const clientUpdatedAt = new Date().toISOString();

    return mutation.mutate(
      {
        targetFolderId: payload.targetFolderId,
        items: payload.ids.map((id) => ({
          id,
          clientUpdatedAt,
        })),
      },
      options
    );
  };

  return { ...mutation, bulkMove };
}
