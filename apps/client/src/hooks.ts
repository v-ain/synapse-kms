import { useUIStore } from './store';
import { trpc } from './utils/trpc';

// Хук получения всех папок
export function useFolders() {
  return trpc.folders.getFolders.useQuery();
}

export function useNotes() {
  const { activeFilter, activeFolderId } = useUIStore();

  return trpc.notes.getNotes.useInfiniteQuery(
    {
      filter: activeFilter,
      folder_id: activeFolderId || undefined,
      limit: '20',
    },
    {
      initialCursor: undefined,
      getNextPageParam: (lastPage) => lastPage.next_cursor || undefined,
    }
  );
}

// Точечный хук для вытягивания ПОЛНОГО контента заметки по UUID
export function useNote(id: string | undefined) {
  return trpc.notes.getById.useQuery(
    { id: id! },
    {
      // Маленькая оптимизация: не делать запрос, если ID еще не выделился в интерфейсе
      enabled: typeof id === 'string' && id.length > 0,
      // Заметка обычно открывается на чтение/редактирование, кэш можно держать подольше
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

// Мутация пакетного перемещения с контролем версий
export function useBulkMoveNotes() {
  const utils = trpc.useUtils();

  return trpc.notes.bulkMove.useMutation({
    // При успехе сносим кэш папок (счетчики) и кэш заметок (лента)
    onSuccess: () => {
      utils.folders.getFolders.invalidate();
      utils.notes.getNotes.invalidate(); // Сбросит ВСЕ вкладки разом через tRPC!
    },
    // Ловим наш оптимистичный замок 409 (в tRPC это CONFLICT)
    onError: (error) => {
      if (error.data?.code === 'CONFLICT') {
        alert(
          '💥 Ошибка конкуренции! Одна из заметок уже была перемещена или изменена. Лента сейчас обновится.'
        );
        utils.notes.getNotes.invalidate();
      } else {
        alert(error.message || 'Что-то пошло не так при перемещении...');
      }
    },
  });
}

// Хук удаления папки
export function useDeleteFolder() {
  const utils = trpc.useUtils();
  const { setActiveFolder } = useUIStore();

  return trpc.folders.delete.useMutation({
    onSuccess: () => {
      // Сбрасываем активную папку в Zustand, чтобы интерфейс не смотрел на удаленную сущность
      setActiveFolder(null);
      utils.folders.getFolders.invalidate();
      // Опционально: если при удалении папки заметки из неё падают в 'inbox',
      // можно также инвалидировать и списки заметок:
      utils.notes.getNotes.invalidate();
    },
  });
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

      // Обновляем контент текущей открытой заметки
      if (variables) {
        utils.notes.getById.invalidate({ id: variables.note_id });
      }
    },
    onError: (err) => {
      alert(`Ошибка привязки тега: ${err.message}`);
    },
  });
}
