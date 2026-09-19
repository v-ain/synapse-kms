import type {
  BulkMovePayload,
  CreateNotePayload,
  GetNotesQueryParams,
  Note,
  NotePreview,
  PaginatedResponse,
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
  updateNote(
    payload: UpdateNotePayload,
    userId: string
  ): Promise<{ conflict: true; note: null } | { conflict: false; note: Note }>;

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
   * Массовое перемещение заметок с флагом оптимистичной блокировки
   */
  bulkMove(
    payload: BulkMovePayload,
    userId: string
  ): Promise<{ success: boolean; conflict?: boolean }>;
}

export interface IFolderService {
  getFolders(userId: string): Promise<any>;
  createFolder(title: string, userId: string): Promise<any>;
  deleteFolder(id: string, userId: string): Promise<any>;
}

export interface IAuthService {
  [key: string]: any;
}

export interface ITagService {
  attachTag(noteId: string, tagName: string, userId: string): Promise<any>;
  getUserTags(userId: string): Promise<any>;
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
