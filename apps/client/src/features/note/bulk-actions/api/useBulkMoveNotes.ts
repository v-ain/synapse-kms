import type { MutateOptions } from '@tanstack/react-query';
import { trpc } from '@/shared/api/trpc';
import { toast } from 'sonner';

interface BulkMovePayload {
  targetFolderId: string | null;
  ids: string[];
}

export function useBulkMoveNotes() {
  const utils = trpc.useUtils();

  const mutation = trpc.notes.bulkMove.useMutation({
    onSuccess: (result) => {
      utils.folders.getFolders.invalidate();
      utils.notes.getNotes.invalidate();

      if (result.movedIds.length === 0) {
        toast.warning(
          'Заметки не перемещены: в базе сохранена более свежая версия'
        );
      } else {
        toast.success(`Перемещено заметок: ${result.movedIds.length}`);
      }
    },
  });

  const bulkMove = (
    payload: BulkMovePayload,
    options?: MutateOptions<any, any, any>
  ) => {
    const clientUpdatedAt = new Date().toISOString();

    mutation.mutate(
      {
        targetFolderId: payload.targetFolderId,
        items: payload.ids.map((id) => ({ id, clientUpdatedAt })),
      },
      options
    );
  };

  return {
    bulkMove,
    isPending: mutation.isPending,
  };
}
