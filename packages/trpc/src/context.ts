import type {
  AttachTagPayload,
  BulkMovePayload,
  CreateNotePayload,
  DeleteFolderPayload,
  Folder,
  GetNotesQueryParams,
  Note,
  NotePreview,
  PaginatedResponse,
  Tag,
  TagWithCount,
  UpdateNotePayload,
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

export interface IAdminService {
  getNotes(query: any, userId: string): Promise<any>;
}

export interface ContextOptions {
  noteService: INoteService;
  folderService: IFolderService;
  authService: IAuthService;
  tagService: ITagService;
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
    adminService: opts.adminService,
    userId: opts.userId,
    userRole: opts.userRole,
    setAuthCookie: opts.setAuthCookie,
  };
}

export type Context = ReturnType<typeof createContext>;
