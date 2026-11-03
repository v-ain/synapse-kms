// apps/server/src/domain/user/value-objects/UserQuota.ts

export interface UserQuotaProps {
  tier: 'free' | 'pro' | 'enterprise';
  maxNotes: number;
  usedNotes: number;
  maxStorageMb: number;
}

export class UserQuota {
  constructor(private readonly props: UserQuotaProps) {}

  get tier() {
    return this.props.tier;
  }
  get maxNotes() {
    return this.props.maxNotes;
  }
  get usedNotes() {
    return this.props.usedNotes;
  }
  get maxStorageMb() {
    return this.props.maxStorageMb;
  }

  /**
   * ⚡ БИЗНЕС-ПРАВИЛО: Проверяем, есть ли свободное место под заметку
   */
  hasAvailableNoteSlot(): boolean {
    return this.props.usedNotes < this.props.maxNotes;
  }

  /**
   * Возвращает новый объект квоты с увеличенным счетчиком
   * В DDD Value Objects — иммутабельны (неизменяемы). Мы возвращаем копию!
   */
  incrementUsedNotes(): UserQuota {
    return new UserQuota({
      ...this.props,
      usedNotes: this.props.usedNotes + 1,
    });
  }
}
