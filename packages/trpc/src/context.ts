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
  getNotes(
    query: GetNotesQueryParams,
    userId: string
  ): Promise<PaginatedResponse<NotePreview>>;
  getNoteById(id: string, userId: string): Promise<Note | null>;
  createNote(payload: CreateNotePayload, userId: string): Promise<Note>;
  updateNote(payload: UpdateNotePayload, userId: string): Promise<any>;
  archiveNote(id: string, userId: string): Promise<any>;
  bulkMove(payload: BulkMovePayload, userId: string): Promise<any>;
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
