import type { NoteService, FolderService } from '@synapse-kms/server';

export interface ContextOptions {
  noteService: NoteService;
  folderService: FolderService;
  userId: string | null;
}

export function createContext(opts: ContextOptions) {
  return {
    noteService: opts.noteService,
    folderService: opts.folderService,
    userId: opts.userId,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
