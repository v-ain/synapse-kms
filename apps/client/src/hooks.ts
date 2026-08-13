import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useUIStore } from './store';

// 🧬 Интерфейсы один в один как на бэкенде
export interface Folder {
  id: string;
  title: string;
  notes_count: number;
  created_at: string;
}

export interface Note {
  id: string;
  folder_id: string | null;
  title: string;
  content?: string;
  preview: string;
  version: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  tags: string[];
}

// 📁 1. Хук получения всех папок
export function useFolders() {
  return useQuery<Folder[]>({
    queryKey: ['folders'],
    queryFn: () => api.get('/folders').then((res) => res.data),
  });
}

// 📝 2. Универсальный хук получения заметок, завязанный на Zustand-координаты!
export function useNotes() {
  const { activeFilter, activeFolderId } = useUIStore();

  return useQuery<Note[]>({
    // Кэш автоматически разделится по вкладкам!
    queryKey: ['notes', activeFilter, activeFolderId],
    // Автоматически шлём текущие UI-координаты на наш универсальный бэкенд
    queryFn: () =>
      api
        .get('/notes', {
          params: { filter: activeFilter, folder_id: activeFolderId },
        })
        .then((res) => res.data),
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
    mutationFn: (data: {
      items: { id: string; version: number }[];
      target_folder_id: string | null;
    }) => api.post('/notes/bulk-move', data).then((res) => res.data),

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
