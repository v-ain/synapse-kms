// server/src/infrastructure/events/TypedEventEmitter.ts
import { SystemEventMap } from '@synapse-kms/shared';
import { EventEmitter } from 'node:events';

export class TypedEventEmitter<
  T extends Record<string, unknown>,
> extends EventEmitter {
  emit<K extends keyof T & string>(event: K, payload: T[K]): boolean {
    return super.emit(event, payload);
  }
  on<K extends keyof T & string>(
    event: K,
    listener: (payload: T[K]) => void
  ): this {
    return super.on(event, listener);
  }
  off<K extends keyof T & string>(
    event: K,
    listener: (payload: T[K]) => void
  ): this {
    return super.off(event, listener);
  }
}

export const globalEventEmitter = new TypedEventEmitter<SystemEventMap>();
