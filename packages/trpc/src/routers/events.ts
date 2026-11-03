import { on } from 'node:events';
import { protectedProcedure, router } from '../trpc.js';
import { tracked } from '@trpc/server';
import { SystemEvent } from '@synapse-kms/shared';

// server/src/infrastructure/events/event-id.ts
let counter = 0;
export const nextEventId = () => `${Date.now()}-${++counter}`;

// Для multi-instance — добавь префикс инстанса (${INSTANCE_ID}-${Date.now()}-${counter}), чтобы id не конфликтовали

export const systemEventRouter = router({
  /**
   *  ГЛОБАЛЬНЫЙ SSE-СТРИМ СИСТЕМНЫХ СОБЫТИЙ
   * Сюда летят и блокировки, и создание/удаление заметок
   */
  onSystemStream: protectedProcedure.subscription(async function* ({
    ctx,
    signal,
  }) {
    const { emitter, unsubscribe } = ctx.systemEventBus.subscribe();

    try {
      for await (const [event] of on(emitter, 'event', { signal })) {
        yield tracked(nextEventId(), event as SystemEvent);
      }
    } finally {
      unsubscribe();
    }
  }),
});
