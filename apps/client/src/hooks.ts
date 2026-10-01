import { useUIStore } from './store';
import { trpc } from './utils/trpc';

// Хук получения всех папок
export function useFolders() {
  return trpc.folders.getFolders.useQuery();
}

export function useNotes() {
  const { activeFilter, activeFolderId, activeTagName, searchQuery } =
    useUIStore();

  // Формируем query-параметры строго по getNotesQueryParamsSchema контракту бэкенда
  const folderId =
    activeFilter === 'folder' ? (activeFolderId ?? undefined) : undefined;
  const tagName =
    activeFilter === 'tag' ? (activeTagName ?? undefined) : undefined;

  return trpc.notes.getNotes.useInfiniteQuery(
    {
      filter: activeFilter, // отправляем 'all' | 'inbox' | 'folder' | 'tag'
      folderId,
      tagName,
      search: searchQuery,
      limit: '20', // tRPC ждет string по схеме бэкенда
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );
}

/**
 * Точечный хук для вытягивания ПОЛНОГО контента заметки по UUID.
 * Гарантированно принимает валидный строковый ID из рабочей области.
 */
export function useNote(id: string) {
  return trpc.notes.getById.useQuery(
    { id }, // Чистая передача без id! или хаков типизации
    {
      // Заметка обычно открывается на длительное редактирование,
      // кэш можно спокойно держать подольше (микросекундная эффективность)
      staleTime: 1000 * 60 * 5,
    }
  );
}

// Хук создания папки
export function useCreateFolder() {
  const utils = trpc.useUtils();

  return trpc.folders.create.useMutation({
    onSuccess: () => {
      // Мгновенно обновляем список папок в боковом меню
      utils.folders.getFolders.invalidate();
    },
  });
}

export function useCreateNote() {
  // Получаем доступ к утилитам контекста tRPC (это обёртка над queryClient)
  const utils = trpc.useUtils();

  return trpc.notes.create.useMutation({
    onSuccess: () => {
      // 1. Обновляем счетчики папок.
      // tRPC автоматически знает правильный ключ кэша для роута folders!
      // (Подставь имя твоего будущего или текущего tRPC-роута папок, например folders.getFolders)
      utils.folders.invalidate();

      // 2. ⚡ МАГИЯ: Затираем вообще все кэши бесконечных списков заметок!
      // Метод invalidate() без параметров сбросит абсолютно все фильтры, папки и курсоры для notes.getNotes
      utils.notes.getNotes.invalidate();
    },
  });
}

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

  // Добавляем второй опциональный аргумент для колбэков типа onSuccess
  const bulkMove = (
    payload: { targetFolderId: string | null; ids: string[] },
    options?: any // Или точный тип опций, если tRPC его экспортирует
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
      options // Пробрасываем опции (onSuccess, onError) дальше в мутацию
    );
  };

  return { ...mutation, bulkMove };
}

// 📂 2. ХУК УДАЛЕНИЯ ПАПКИ (LWW)
export function useDeleteFolder() {
  const utils = trpc.useUtils();
  const { setActiveFolder } = useUIStore();

  const mutation = trpc.folders.delete.useMutation({
    onSuccess: () => {
      // Сбрасываем активную папку, чтобы не смотреть на удаленную сущность
      setActiveFolder(null);
      utils.folders.getFolders.invalidate();
      utils.notes.getNotes.invalidate(); // Заметки выпали во Входящие
    },
    onError: (error) => {
      alert(error.message || 'Не удалось удалить папку.');
    },
  });

  const deleteFolder = (id: string) => {
    return mutation.mutate({
      id,
      clientUpdatedAt: new Date().toISOString(), // Фиксируем точное время удаления папки
    });
  };

  return { ...mutation, deleteFolder };
}

// Мутация мягкого удаления (архивации) ОДНОЙ заметки
export function useArchiveNote() {
  const utils = trpc.useUtils();
  const { setActiveNote } = useUIStore();

  return trpc.notes.archive.useMutation({
    onSuccess: () => {
      setActiveNote(null);
      utils.notes.getNotes.invalidate();
    },
  });
}

// Мутация привязки тега к заметке
export function useAttachTag() {
  const utils = trpc.useUtils();

  return trpc.tags.attach.useMutation({
    onSuccess: (_data, variables) => {
      // Обновляем ленту заметок (чтобы тег появился на превью)
      utils.notes.getNotes.invalidate();
      utils.tags.list.invalidate();
      // Обновляем контент текущей открытой заметки
      if (variables) {
        utils.notes.getById.invalidate({ id: variables.noteId });
      }
    },
    onError: (err) => {
      alert(`Ошибка привязки тега: ${err.message}`);
    },
  });
}

// 3. ХУК ОБНОВЛЕНИЯ ЗАМЕТКИ (LWW)
export function useUpdateNote() {
  const utils = trpc.useUtils();

  const mutation = trpc.notes.update.useMutation({
    // Включаем безопасные LWW-ретраи для отказоустойчивости при моргании сети
    retry: 3,
    retryDelay: (attempt) => Math.min(attempt * 1000, 5000),

    onSuccess: (updatedNote) => {
      // Точечно синхронизируем кэш конкретной заметки
      utils.notes.getById.setData({ id: updatedNote.id }, updatedNote);
      // Мягко уведомляем списки без жесткого рефетча посреди ввода
      utils.notes.getNotes.invalidate();
    },
    onError: (error) => {
      console.error('Ошибка сохранения заметки:', error.message);
    },
  });

  // Добавляем поддержку стандартных TanStack опций вызова (onSuccess, onError)
  const updateNote = (
    payload: { id: string; title?: string; content?: string },
    options?: { onSuccess?: (data: any) => void; onError?: (err: any) => void }
  ) => {
    return mutation.mutate(
      {
        ...payload,
        clientUpdatedAt: new Date().toISOString(),
      },
      options
    );
  };

  return { ...mutation, updateNote };
}

export function useTags() {
  return trpc.tags.list.useQuery();
}
