// server/src/infrastructure/events/SystemEventBus.ts
import { SystemEvent } from '@synapse-kms/shared';
import EventEmitter from 'node:events';

// SystemEventBus.ts (синглтон на процесс)
class SystemEventBus {
  private readonly emitter = new EventEmitter();
  private readonly clients = new Set<EventEmitter>();

  constructor() {
    // Один слушатель на процесс для каждого типа события
    this.emitter.on('NOTE_MUTATED', (event: SystemEvent) =>
      this.broadcast(event)
    );
    this.emitter.on('LOCK_UPDATED', (event: SystemEvent) =>
      this.broadcast(event)
    );
  }

  publish(event: SystemEvent) {
    this.emitter.emit(event.type, event);
  }

  subscribe(): { emitter: EventEmitter; unsubscribe: () => void } {
    const localEmitter = new EventEmitter();
    this.clients.add(localEmitter);
    return {
      emitter: localEmitter,
      unsubscribe: () => {
        this.clients.delete(localEmitter);
        localEmitter.removeAllListeners(); // чистим слушатели локального эмиттера
      },
    };
  }

  private broadcast(event: SystemEvent) {
    for (const localEmitter of this.clients) {
      // Локальный эмиттер может не иметь слушателей, если стрим ещё не подписался
      // (между subscribe() и on()). Это нормально — события просто не доставляются.
      localEmitter.emit('event', event);
    }
  }
}

export const systemEventBus = new SystemEventBus();
export { type SystemEventBus };
