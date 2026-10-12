import type {
  AttachTagPayload,
  BulkMovePayload,
  CreateNotePayload,
  DeleteFolderPayload,
  Folder,
  FolderAccessResult,
  GetNotesQueryParams,
  Note,
  NotePreview,
  PaginatedResponse,
  Tag,
  TagWithCount,
  UpdateNotePayload,
  UserEntity,
} from '@synapse-kms/shared';

export interface INoteService {
  /**
   * Получение пагинированного списка превью заметок (даты: string)
   */
  getNotes(
    query: GetNotesQueryParams,
    userId: string
  ): Promise<PaginatedResponse<NotePreview>>;

  /**
   * Получение полной заметки по ID (даты: string)
   */
  getNoteById(id: string, userId: string): Promise<Note | null>;

  /**
   * Создание новой заметки (даты: string)
   */
  createNote(payload: CreateNotePayload, userId: string): Promise<Note>;

  /**
   * Обновление данных заметки с проверкой версии (Optimistic Lock)
   */
  updateNote(payload: UpdateNotePayload, userId: string): Promise<Note | null>;

  /**
   * Архивация заметки
   */
  archiveNote(
    id: string,
    userId: string
  ): Promise<
    | { error: string; status: number; success?: never }
    | { error: null; success: true; status?: never }
  >;

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
  getFolders(userId: string): Promise<Folder[]>;

  /**
   * Создание новой папки
   */
  createFolder(title: string, userId: string): Promise<Folder>;

  /**
   * Безопасное удаление папки (Soft delete) с освобождением заметок по LWW
   * Возвращает true, если папка успешно удалена, либо false, если она не найдена/удалена ранее
   */
  deleteFolder(payload: DeleteFolderPayload, userId: string): Promise<boolean>;

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
    targetEmail: string; // Меняем targetUserId на targetEmail для безопасности
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
  findByEmail(email: string): Promise<UserEntity | null>;
  getUserProfile(id: string): Promise<Omit<UserEntity, 'passwordHash'> | null>;
}

export interface IAdminService {
  getNotes(query: any, userId: string): Promise<any>;
}

export interface ContextOptions {
  noteService: INoteService;
  folderService: IFolderService;
  authService: IAuthService;
  tagService: ITagService;
  userService: IUserService;
  adminService: IAdminService;
  userId: string | null;
  userRole: string | null;
  setAuthCookie?: (token: string) => void;
}

export function createContext(opts: ContextOptions) {
  return {
    noteService: opts.noteService,
    folderService: opts.folderService,
    authService: opts.authService,
    tagService: opts.tagService,
    userService: opts.userService,
    adminService: opts.adminService,
    userId: opts.userId,
    userRole: opts.userRole,
    setAuthCookie: opts.setAuthCookie,
  };
}

export type Context = ReturnType<typeof createContext>;
