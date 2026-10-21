import { trpc } from '@/utils/trpc';
import { useUIStore } from '@/store';
import type { NotePreviewDTO } from '@synapse-kms/shared';
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
    limit: '20',
  };

  // Переключаемся на наш универсальный эндпоинт системных событий
  trpc.notesLock.onSystemEvent.useSubscription(undefined, {
    onData(envelope) {
      // В envelope.id теперь прилетает строка-идентификатор события ('LOCK_UPDATED' / 'NOTE_MUTATED')
      const eventType = envelope.id;
      const payload = envelope.data;

      switch (eventType) {
        // СЦЕНАРИЙ 1: Живое обновление блокировок
        case 'LOCK_UPDATED': {
          const { noteId, lock: lockInfo } = payload;

          console.log(`[SSE] Точечно мутируем лок для заметки ${noteId}`);

          utils.notes.getNotes.setInfiniteData(
            currentFilters,
            (oldData: any) => {
              if (!oldData || !oldData.pages) return oldData;
              return {
                ...oldData,
                pages: oldData.pages.map((page: any) => ({
                  ...page,
                  items: page.items.map((note: NotePreviewDTO) =>
                    note.id === noteId ? { ...note, lock: lockInfo } : note
                  ),
                })),
              };
            }
          );
          break;
        }

        // СЦЕНАРИЙ 2: Кто-то создал или изменил заметку в системе
        case 'NOTE_MUTATED': {
          // Если мутацию сделал я сам — игнорируем, наш клиент уже обновился локально
          if (payload.userId === currentUserId) return;

          console.log(
            `[SSE] Системное событие: ${payload.type} от пользователя ${payload.userId}`
          );

          if (payload.type === 'CREATED') {
            // Мягко помечаем кэш списков устаревшим — TanStack сам сделает фоновый дозапрос
            utils.notes.getNotes.invalidate();

            // Заодно обновляем счетчик папок, чтобы циферки в сайдбаре синхронизировались!
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
