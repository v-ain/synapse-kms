// apps/server/src/domain/user/model/User.ts
import { UserQuota } from '../value-objects/UserQuota.js';

export interface UserProps {
  id: string;
  role: 'admin' | 'user';
  status: 'active' | 'suspended' | 'deleted';
  username: string;
  displayName: string | null;
  quota: UserQuota;
}

export class User {
  private constructor(private readonly props: UserProps) {}

  // Геттеры для безопасного чтения данных наружу
  get id() {
    return this.props.id;
  }
  get username() {
    return this.props.username;
  }
  get displayName() {
    return this.props.displayName;
  }
  get quota() {
    return this.props.quota;
  }

  /**
   * 🏭 Фабричный метод для создания экземпляра (инкапсулирует валидацию при рождении)
   */
  static create(props: UserProps): User {
    if (!props.username.startsWith('@')) {
      // Пример бизнес-валидации: заставим никнеймы всегда начинаться с @
      props.username = `@${props.username.replace(/^@/, '')}`;
    }
    return new User(props);
  }

  /**
   * 🛡️ ИНВАРИАНТ БИЗНЕСА: Проверка возможности создания заметки
   */
  canCreateNote(): boolean {
    if (this.props.status !== 'active') return false; // Забаненные не пишут
    return this.props.quota.hasAvailableNoteSlot();
  }

  /**
   * 🚀 ДЕЙСТВИЕ: Увеличение счетчика заметок
   */
  executeNoteCreation(): void {
    if (!this.canCreateNote()) {
      throw new Error(
        `User custom quota exceeded or account is not active. Limit: ${this.props.quota.maxNotes}`
      );
    }
    // Мутируем квоту внутри агрегата
    this.props.quota = this.props.quota.incrementUsedNotes();
  }
}
