import { trpc } from '@/utils/trpc';
import { useUIStore } from '@/store'; // Подтягиваем твой Zustand-стор UI
import type { NotePreviewDTO } from '@synapse-kms/shared';

export function useLockSubscription() {
  const utils = trpc.useUtils();

  // Достаем ровно те же фильтры, что используются в хуке useNotes()
  const { activeFilter, activeFolderId, activeTagName, searchQuery } =
    useUIStore();

  // Формируем query-параметры в точности как в useNotes()
  const folderId =
    activeFilter === 'folder' ? (activeFolderId ?? undefined) : undefined;
  const tagName =
    activeFilter === 'tag' ? (activeTagName ?? undefined) : undefined;

  trpc.notesLock.onLockStatusChanged.useSubscription(undefined, {
    onData(envelope) {
      const { id: noteId, data: lockInfo } = envelope;

      console.log(
        `[SSE] Мутируем кэш для текущего фильтра "${activeFilter}":`,
        lockInfo
      );

      // Передаем объект фильтров первым аргументом, чтобы tRPC попал точно в активный кэш!
      utils.notes.getNotes.setInfiniteData(
        {
          filter: activeFilter,
          folderId,
          tagName,
          search: searchQuery,
          limit: '20',
        },
        (oldData: any) => {
          if (!oldData || !oldData.pages) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              items: page.items.map((note: NotePreviewDTO) =>
                note.id === noteId
                  ? { ...note, lock: lockInfo } // Обновляем лок
                  : note
              ),
            })),
          };
        }
      );
    },
    onError(err) {
      console.error('[SSE Error] Ошибка стрима блокировок:', err);
    },
  });
}
