import { protectedProcedure, router } from '../trpc.js';
import { SYSTEM_EVENTS } from '@synapse-kms/shared';
import { tracked } from '@trpc/server';

// Описываем типы для полезной нагрузки мутаций заметок
export interface NoteMutatedPayload {
  type: 'CREATED' | 'DELETED' | 'UPDATED';
  noteId: string;
  folderId: string | null;
  userId: string; // Кто совершил мутацию, чтобы создатель её игнорировал
}

export const systemEventRouter = router({
  /**
   *  ГЛОБАЛЬНЫЙ SSE-СТРИМ СИСТЕМНЫХ СОБЫТИЙ
   * Сюда летят и блокировки, и создание/удаление заметок
   */
  onSystemEvent: protectedProcedure.subscription(async function* (opts) {
    const { ctx } = opts;
    const eventQueue: Array<{ eventType: string; payload: any }> = [];

    // Универсальный слушатель, который упаковывает тип события и его данные
    const lockListener = (data: any) =>
      eventQueue.push({ eventType: 'LOCK_UPDATED', payload: data });
    const noteListener = (data: any) =>
      eventQueue.push({ eventType: 'NOTE_MUTATED', payload: data });

    // Подписываемся на оба события бэкенд-процесса
    ctx.eventEmitter.on(SYSTEM_EVENTS.LOCK_UPDATED, lockListener);
    ctx.eventEmitter.on(SYSTEM_EVENTS.NOTE_MUTATED, noteListener);

    try {
      while (true) {
        while (eventQueue.length > 0) {
          const event = eventQueue.shift();
          if (event) {
            // tracked связывает ID (тип события) с телом сообщения
            yield tracked(event.eventType, event.payload);
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } finally {
      // КРИТИЧЕСКИ ВАЖНО: Чистим за собой оба слушателя при обрыве соединения
      ctx.eventEmitter.off(SYSTEM_EVENTS.LOCK_UPDATED, lockListener);
      ctx.eventEmitter.off(SYSTEM_EVENTS.NOTE_MUTATED, noteListener);
    }
  }),
});
