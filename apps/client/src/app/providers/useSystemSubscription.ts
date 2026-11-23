import { trpc } from '@/shared/api/trpc';
import { useAuthStore } from '@/entities/user';
import { useNoteFiltersStore } from '@/features/note/filter';
import { NOTES_PAGE_SIZE, type SystemEvent } from '@synapse-kms/shared';

export function useSystemSubscription() {
  const utils = trpc.useUtils();
  const currentUserId = useAuthStore((state) => state.userId);

  trpc.events.onSystemStream.useSubscription(undefined, {
    onData(envelope) {
      const event = envelope.data as SystemEvent;

      switch (event.type) {
        case 'LOCK_UPDATED': {
          const { noteId, lock: lockInfo, actorUserId, type } = event.payload;

          if (actorUserId === currentUserId) break;

          // Читаем свежайшие фильтры напрямую из стора в момент прихода события
          const { activeFilter, activeFolderId, activeTagName, searchQuery } =
            useNoteFiltersStore.getState();

          const currentFilters = {
            filter: activeFilter,
            folderId:
              activeFilter === 'folder'
                ? (activeFolderId ?? undefined)
                : undefined,
            tagName:
              activeFilter === 'tag' ? (activeTagName ?? undefined) : undefined,
            search: searchQuery,
            limit: NOTES_PAGE_SIZE,
          };

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

          if (type === 'RELEASED' && !lockInfo?.isLocked) {
            // TODO: retry acquire из useNoteLock
          }
          break;
        }

        case 'NOTE_MUTATED': {
          const { noteId, type } = event.payload;

          utils.notes.getNotes.invalidate();

          if (type === 'DELETED') {
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
