export interface INoteService {
  getNotes(query: any, userId: string): Promise<any>;
  getNoteById(id: string, userId: string): Promise<any>;
  createNote(payload: any, userId: string): Promise<any>;
  updateNote(payload: any, userId: string): Promise<any>;
  archiveNote(id: string, userId: string): Promise<any>;
  bulkMove(payload: any, userId: string): Promise<any>;
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
