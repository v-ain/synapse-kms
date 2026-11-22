import { trpc } from '@/shared/api/trpc';

export function useUpdateNoteMeta() {
  const mutation = trpc.notes.updateMeta.useMutation({
    retry: 3,
    retryDelay: (attempt) => Math.min(attempt * 1000, 5000),
    onError: (error) => {
      console.error('Ошибка сохранения заметки:', error.message);
    },
  });

  const updateNote = (
    payload: { noteId: string; title: string },
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

export function useNoteAutoSave() {
  const mutation = trpc.notes.autoSaveContent.useMutation({
    onError: (error) => {
      window.alert('Ошибка сохранения заметки:');
      console.error('Ошибка сохранения заметки:', error.message);
    },
  });

  const updateNote = (
    payload: { id: string; content: string },
    options?: { onSuccess?: (data: any) => void; onError?: (err: any) => void }
  ) => {
    return mutation.mutate(
      {
        noteId: payload.id,
        content: payload.content,
        clientUpdatedAt: new Date().toISOString(),
      },
      options
    );
  };

  return { ...mutation, updateNote };
}
