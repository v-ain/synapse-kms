import { useEffect } from 'react';
import { trpc } from '../utils/trpc'; // Твой клиентский инстанс tRPC
import { useNoteLockStore } from '../store/useNoteLockStore';
import { useAuthStore } from '../store/useAuthStore';

export function useNoteLock(noteId: string) {
  const currentUserId = useAuthStore((state) => state.userId);
  const updateLockStatus = useNoteLockStore((state) => state.updateLockStatus);
  const resetLock = useNoteLockStore((state) => state.resetLock);
  const isReadOnly = useNoteLockStore((state) => state.isReadOnly);
  const lockedByUserName = useNoteLockStore((state) => state.lockedByUserName);

  // tRPC Мутации
  const acquireMutation = trpc.notesLock.acquireLock.useMutation();
  const renewMutation = trpc.notesLock.renewLock.useMutation();
  const releaseMutation = trpc.notesLock.releaseLock.useMutation();

  useEffect(() => {
    // Защита: если юзер еще не загрузился или заметка не выбрана
    if (!noteId || !currentUserId) return;

    // 1. При заходе — сразу берем блокировку
    const captureLock = async () => {
      try {
        const result = await acquireMutation.mutateAsync({ noteId });

        // Передаем статус в Zustand
        updateLockStatus(currentUserId, {
          isLocked: !result.success, // Если успех=false, значит залочено кем-то другим
          lockedBy: result.lockedBy,
          lockedByName: result.lockedBy === currentUserId ? 'Вы' : 'Коллега', // Имя можно прокинуть из DTO
          expiresAt: Date.now() + result.expiresIn * 1000,
        });
      } catch (err) {
        console.error('Ошибка захвата замка:', err);
      }
    };

    captureLock();

    // 2. Ставим интервал на продление (Heartbeat) каждые 10 секунд
    const heartbeatInterval = setInterval(async () => {
      // Продлеваем только если мы не в режиме Read-Only
      if (!useNoteLockStore.getState().isReadOnly) {
        try {
          await renewMutation.mutateAsync({ noteId });
        } catch (err) {
          console.error('Не удалось продлить аренду замка:', err);
        }
      }
    }, 10000); // 10 сек (при TTL в Redis = 30 сек — идеальный запас)

    // 3. Cleanup-функция: срабатывает при закрытии блокнота или смене заметки
    return () => {
      clearInterval(heartbeatInterval);

      // Отпускаем замок на сервере, если мы им владели
      if (!useNoteLockStore.getState().isReadOnly) {
        releaseMutation.mutate({ noteId });
      }

      resetLock();
    };
  }, [noteId, currentUserId]);

  return { isReadOnly, lockedByUserName };
}
