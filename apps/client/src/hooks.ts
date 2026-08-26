import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { api } from './api';
import { useUIStore } from './store';
import type {
  Note,
  Folder,
  BulkMovePayload,
  PaginatedResponse,
  GetNotesQueryParams,
  NotePreview,
} from '@synapse-kms/shared';

// Хук получения всех папок
export function useFolders() {
  const { currentUserId } = useUIStore();
  return useQuery<Folder[]>({
    // Добавляем currentUserId первым элементом в ключ
    queryKey: ['folders', currentUserId],
    queryFn: () => api.get('/folders').then((res) => res.data),
  });
}

export function useNotes() {
  const { activeFilter, activeFolderId, currentUserId } = useUIStore();

  return useInfiniteQuery<PaginatedResponse<NotePreview>>({
    // Ключ кэша теперь учитывает пагинацию
    queryKey: ['notes', currentUserId, activeFilter, activeFolderId],

    // Функция запроса принимает специальный параметр pageParam, куда TanStack положит наш курсор
    queryFn: ({ pageParam }) => {
      const params: GetNotesQueryParams = {
        filter: activeFilter,
        folder_id: activeFolderId || undefined,
        limit: '20',
        cursor: (pageParam as string) || undefined, // курсор в параметры запроса к Fastify
      };
      return api.get('/notes', { params }).then((res) => res.data);
    },

    // Говорим хуку, откуда брать следующий курсор для новой страницы
    getNextPageParam: (lastPage) => lastPage.next_cursor || undefined,
    initialPageParam: undefined, // Первая страница загружается без курсора
  });
}

// 🎯 3. Точечный хук для вытягивания ПОЛНОГО контента заметки по UUID
export function useNoteContent(id: string | null) {
  return useQuery<Note>({
    // Уникальный ключ кэша для каждого документа!
    queryKey: ['note-content', id],
    // Запрос сработает только если ID физически существует (не null)
    queryFn: () => api.get(`/notes/${id}`).then((res) => res.data),
    enabled: !!id,
  });
}

// 🎯 4. Мутация создания папки
export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title: string) =>
      api.post('/folders', { title }).then((res) => res.data),
    // Как только папка успешно создалась на бэкенде — инвалидируем список папок
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
  });
}

// 🎯 Обновленный хук создания заметки в frontend/src/hooks.ts
export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title: string;
      content: string;
      folder_id: string | null;
    }) => api.post('/notes', data).then((res) => res.data),

    onSuccess: () => {
      // 1. Обновляем счетчики папок
      queryClient.invalidateQueries({ queryKey: ['folders'] });

      // 2. ⚡ МАГИЯ: Затираем ВООБЩЕ ВСЕ кэши, которые начинаются на ['notes']!
      // Сбросится и вкладка 'all', и 'inbox', и любые папки. Полная синхронизация!
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

// 📦 6. Мутация пакетного перемещения с контролем версий
export function useBulkMoveNotes() {
  const queryClient = useQueryClient();
  const { activeFilter, activeFolderId } = useUIStore();

  return useMutation({
    mutationFn: (data: BulkMovePayload) =>
      api.post('/notes/bulk-move', data).then((res) => res.data),

    // При успехе сносим кэш папок (счетчики) и кэш заметок (лента)
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['notes'] }); // Сбросит ВСЕ вкладки разом!
    },
    // А вот тут ловим наш оптимистичный замок 409!
    onError: (error: any) => {
      if (error.response?.status === 409) {
        alert(
          '💥 Ошибка конкуренции! Одна из заметок уже была перемещена или изменена. Лента сейчас обновится.'
        );
        queryClient.invalidateQueries({ queryKey: ['notes'] });
      } else {
        alert('Что-то пошло не так при перемещении...');
      }
    },
  });
}

// 🗑️ 7. Мутация удаления папки
export function useDeleteFolder() {
  const queryClient = useQueryClient();
  const { setActiveFolder } = useUIStore();

  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/folders/${id}`).then((res) => res.data),
    onSuccess: () => {
      // Сбрасываем активную папку в Zustand, чтобы интерфейс не смотрел на удаленную сущность
      setActiveFolder(null);
      // Инвалидируем папки и заметки (ведь заметки улетели во Входящие!)
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

// 📦 8. Мутация мягкого удаления (архивации) ОДНОЙ заметки
export function useArchiveNote() {
  const queryClient = useQueryClient();
  const { setActiveNote } = useUIStore();

  return useMutation({
    mutationFn: (id: string) =>
      api.patch(`/notes/${id}/archive`).then((res) => res.data),
    onSuccess: () => {
      setActiveNote(null); // Закрываем правое окно просмотра
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

// 🏷️ 9. Мутация привязки тега к заметке
export function useAttachTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { note_id: string; tag_name: string }) =>
      api.post('/notes/attach-tag', data).then((res) => res.data),
    onSuccess: () => {
      // Перезапрашиваем списки заметок и контент, чтобы тег сразу отрендерился на экране
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['note-content'] });
    },
    onError: (err: any) => {
      console.error('Ошибка привязки тега:', err.response?.data || err.message);
      alert(
        'Ошибка 400! Проверь консоль браузера (вкладку Network), чтобы увидеть схему валидации бэкенда.'
      );
    },
  });
}
