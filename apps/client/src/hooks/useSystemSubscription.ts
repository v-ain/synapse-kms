import { trpc } from '@/utils/trpc';
import { useUIStore } from '@/store';
import { NOTES_PAGE_SIZE, type NotePreviewDTO } from '@synapse-kms/shared';
import { useAuthStore } from '@/store/useAuthStore';

export function useSystemSubscription() {
  const utils = trpc.useUtils();
  const currentUserId = useAuthStore((state) => state.userId); // Берем текущего юзера

  // Достаем ровно те же фильтры, что используются в хуке useNotes()
  const { activeFilter, activeFolderId, activeTagName, searchQuery } =
    useUIStore();

  // Формируем query-параметры в точности как в useNotes()
  const folderId =
    activeFilter === 'folder' ? (activeFolderId ?? undefined) : undefined;
  const tagName =
    activeFilter === 'tag' ? (activeTagName ?? undefined) : undefined;

  const currentFilters = {
    filter: activeFilter,
    folderId,
    tagName,
    search: searchQuery,
    limit: NOTES_PAGE_SIZE, // константа, тот же тип, что в useNotes()
  };

  // Переключаемся на наш универсальный эндпоинт системных событий
  trpc.events.onSystemEvent.useSubscription(undefined, {
    onData(envelope) {
      // В envelope.id теперь прилетает строка-идентификатор события ('LOCK_UPDATED' / 'NOTE_MUTATED')
      const eventType = envelope.id;
      const payload = envelope.data;

      switch (eventType) {
        // СЦЕНАРИЙ 1: Живое обновление блокировок
        case 'LOCK_UPDATED': {
          const { noteId, lock: lockInfo, actorUserId } = payload;

          console.log(`[SSE] Точечно мутируем лок для заметки ${noteId}`);

          // Свой acquire/renew — не перерисовываем (мы и так знаем)
          // if (actorUserId === currentUserId) break;

          utils.notes.getNotes.setInfiniteData(currentFilters, (oldData) => {
            if (!oldData || !oldData.pages) return oldData;
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
          if (payload.type === 'RELEASED' && !lockInfo?.isLocked) {
            // здесь можно вызвать retry acquire из useNoteLock
            // (см. обсуждение багов useNoteLock — это тот самый кейс)
          }
          break;
        }

        // СЦЕНАРИЙ 2: Кто-то создал или изменил заметку в системе
        case 'NOTE_MUTATED': {
          console.log(
            `[SSE] Системное событие: ${payload.type} от пользователя ${payload.actorUserId}`
          );

          // Свои мутации не фильтруем: TanStack сам решит по staleTime,
          // делать ли рефетч. Фильтрация по userId — сложность не по делу.
          // if (payload.userId === currentUserId) return;
          utils.notes.getNotes.invalidate();
          utils.notes.getById.invalidate(
            { id: payload.noteId },
            { refetchType: 'all' }
          );

          if (payload.type === 'CREATED' || payload.type === 'DELETED') {
            // Мягко помечаем кэш списков устаревшим — TanStack сам сделает фоновый дозапрос
            // utils.notes.getNotes.invalidate();

            // Обновляем счетчик папок
            utils.folders.getFolders.invalidate();
          }
          break;
        }

        default:
          console.warn(
            `[SSE] Получено неизвестное системное событие: ${eventType}`
          );
      }
    },
    onError(err) {
      console.error(
        '[SSE Error] Ошибка единого стрима системных событий:',
        err
      );
    },
  });
}
