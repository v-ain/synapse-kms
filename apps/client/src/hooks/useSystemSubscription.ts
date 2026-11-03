import { trpc } from '@/utils/trpc';
import { useUIStore } from '@/store';
import { useAuthStore } from '@/store/useAuthStore';
import { NOTES_PAGE_SIZE, type SystemEvent } from '@synapse-kms/shared';

export function useSystemSubscription() {
  const utils = trpc.useUtils();
  const currentUserId = useAuthStore((state) => state.userId);

  const { activeFilter, activeFolderId, activeTagName, searchQuery } =
    useUIStore();

  const folderId =
    activeFilter === 'folder' ? (activeFolderId ?? undefined) : undefined;
  const tagName =
    activeFilter === 'tag' ? (activeTagName ?? undefined) : undefined;

  const currentFilters = {
    filter: activeFilter,
    folderId,
    tagName,
    search: searchQuery,
    limit: NOTES_PAGE_SIZE,
  };

  trpc.events.onSystemStream.useSubscription(undefined, {
    onData(envelope) {
      const event = envelope.data as SystemEvent;

      switch (event.type) {
        case 'LOCK_UPDATED': {
          const { noteId, lock: lockInfo, actorUserId, type } = event.payload;

          // Свой acquire/renew — не перерисовываем (мы и так знаем)
          if (actorUserId === currentUserId) break;

          utils.notes.getNotes.setInfiniteData(currentFilters, (oldData) => {
            if (!oldData) return oldData;
            return {
              ...oldData,
              pages: oldData.pages.map((page) => ({
                ...page,
                items: page.items.map((note) =>
                  note.id === noteId ? { ...note, lock: lockInfo } : note
                ),
              })),
            };
          });

          // Если лок освободился, а мы в readOnly — попробовать захватить
          if (type === 'RELEASED' && !lockInfo?.isLocked) {
            // TODO: retry acquire из useNoteLock
          }
          break;
        }

        case 'NOTE_MUTATED': {
          const { noteId, type } = event.payload;

          utils.notes.getNotes.invalidate();

          if (type === 'DELETED') {
            // Удалённую заметку не рефетчим — сбрасываем кэш
            utils.notes.getById.reset({ id: noteId });
          } else {
            utils.notes.getById.invalidate(
              { id: noteId },
              { refetchType: 'all' }
            );
          }

          if (type === 'CREATED' || type === 'DELETED') {
            utils.folders.getFolders.invalidate();
          }
          break;
        }

        default: {
          const _exhaustive: never = event;
          console.warn('[SSE] Неизвестное событие', _exhaustive);
        }
      }
    },
    onError(err) {
      console.error('[SSE Error]', err);
    },
  });
}
