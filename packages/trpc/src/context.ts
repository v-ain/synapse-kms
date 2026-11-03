import type { EventEmitter } from 'events';
import type {
  AttachTagPayload,
  AutoSaveNotePayload,
  BulkMovePayload,
  CheckNoteAccessResult,
  CreateNotePayload,
  DeleteFolderPayload,
  Folder,
  FolderAccessResult,
  FolderDTO,
  GetNotesQueryParams,
  LockUpdatedPayload,
  Note,
  NoteDTO,
  NoteLockInfo,
  NotePreviewDTO,
  NoteWriteResult,
  PaginatedResponse,
  SystemEvent,
  Tag,
  TagWithCount,
  UpdateNoteMetaPayload,
  UserContext,
  UserEntity,
} from '@synapse-kms/shared';

export interface INoteService {
  checkNoteAccess(
    noteId: string,
    userId: string
  ): Promise<CheckNoteAccessResult>;

  /**
   * Получение пагинированного списка превью заметок (даты: string)
   */
  getNotes(
    query: GetNotesQueryParams,
    userId: string
  ): Promise<PaginatedResponse<NotePreviewDTO>>;

  /**
   * Получение полной заметки по ID (даты: string)
   */
  getNoteById(id: string): Promise<NoteDTO | null>;

  /**
   * Создание новой заметки (даты: string)
   */
  createNote(payload: CreateNotePayload, userId: string): Promise<Note>;

  updateMeta(
    payload: UpdateNoteMetaPayload,
    actorUserId: string
  ): Promise<NoteWriteResult>;

  autoSaveContent(
    payload: AutoSaveNotePayload,
    actorUserId: string
  ): Promise<NoteWriteResult>;

  /**
   * Архивация заметки
   */
  archiveNote(
    id: string
  ): Promise<{ success: boolean; error?: string; status?: number }>;

  /**
   * Массовое перемещение заметок с атомарной защитой Last-Write-Wins (LWW)
   */
  bulkMove(
    payload: BulkMovePayload,
    userId: string
  ): Promise<{ success: boolean; movedIds: string[] }>;
}

export interface IFolderService {
  /**
   * Получение списка всех активных (не удаленных) папок пользователя
   */
  getFolders(userId: string): Promise<FolderDTO[]>;

  /**
   * Создание новой папки
   */
  createFolder(title: string, userId: string): Promise<Folder>;

  /**
   * Безопасное удаление папки (Soft delete) с освобождением заметок по LWW
   * Возвращает true, если папка успешно удалена, либо false, если она не найдена/удалена ранее
   */
  deleteFolder(payload: DeleteFolderPayload): Promise<boolean>;

  /**
   * Проверка прав доступа пользователя к конкретной папке (Владелец / Шеринг)
   */
  checkFolderAccess(
    folderId: string,
    userId: string
  ): Promise<FolderAccessResult>;

  /**
   * Расшаривание папки другому пользователю по его Email
   */
  shareFolder(payload: {
    folderId: string;
    ownerId: string;
    username: string; // Меняем targetEmail на username для скрытия
    accessLevel: 'read' | 'write';
  }): Promise<{
    success: boolean;
    sharedWith: string;
    accessLevel: 'read' | 'write';
  }>;
}

export interface IAuthService {
  [key: string]: any;
}

export interface ITagService {
  attachTag(
    payload: AttachTagPayload,
    userId: string
  ): Promise<{ success: true; tag: Tag }>;
  getUserTags(userId: string): Promise<TagWithCount[]>;
}

export interface IUserService {
  findById(id: string): Promise<UserEntity | null>;
  findByUsername(
    email: string
  ): Promise<{ id: string; username: string } | null>;
  getUserProfile(id: string): Promise<{
    id: string;
    username: string;
    displayName: string | null;
    role: string;
  } | null>;
  getShareableUsers(
    currentUserId: string
  ): Promise<{ id: string; username: string }[]>;
}

export interface LockAcquireResult {
  success: boolean;
  lockedBy: string;
  expiresIn: number; // сколько секунд осталось
}

export interface INoteLockService {
  /**
   * Пытается установить атомарный ключ в Redis (NX) на 30 секунд.
   * Если ключ уже занят текущим userId — продлевает его.
   */
  acquire(noteId: string, userId: string): Promise<LockAcquireResult>;

  /**
   * Обновляет TTL блокировки (проверяя, что замок всё еще принадлежит этому юзеру)
   */
  renew(noteId: string, userId: string): Promise<boolean>;

  /**
   * Удаляет ключ блокировки из Redis (атомарно через Lua-скрипт, чтобы не удалить чужой замок)
   */
  release(noteId: string, userId: string): Promise<void>;

  isLockedByOthers(noteId: string, userId: string): Promise<boolean>;

  getLockInfo(noteId: string): Promise<NoteLockInfo>;

  getLocksForNotes(noteIds: string[]): Promise<Record<string, NoteLockInfo>>;
}

export interface INoteEventPublisher {
  noteCreated(
    noteId: string,
    folderId: string | null,
    actorUserId: string
  ): void;

  lockUpdated(payload: LockUpdatedPayload): void;
}

export interface ISystemEventBus {
  publish(event: SystemEvent): void;
  subscribe(): { emitter: EventEmitter; unsubscribe: () => void };
}

export interface ContextOptions {
  noteService: INoteService;
  folderService: IFolderService;
  authService: IAuthService;
  tagService: ITagService;
  userService: IUserService;
  noteLockService: INoteLockService;
  eventEmitter: EventEmitter;
  noteEventPublisher: INoteEventPublisher;
  autoSaveContentUseCase: any;
  user: UserContext | null;
  setAuthCookie?: (token: string) => void;
  systemEventBus: ISystemEventBus;
}

export function createContext(opts: ContextOptions) {
  return {
    ...opts,
    // noteService: opts.noteService,
    // folderService: opts.folderService,
    // authService: opts.authService,
    // tagService: opts.tagService,
    // userService: opts.userService,
    // noteLockService: opts.noteLockService,
    // eventEmitter: opts.eventEmitter,
    // user: opts.user,
    // setAuthCookie: opts.setAuthCookie,
  };
}

export type Context = ReturnType<typeof createContext>;
