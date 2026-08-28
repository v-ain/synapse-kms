import type { FastifyReply } from 'fastify';

import type {
  NoteService,
  FolderService,
  AuthService,
  TagService,
} from '@synapse-kms/server';

export interface ContextOptions {
  noteService: NoteService;
  folderService: FolderService;
  authService: AuthService;
  tagService: TagService;
  userId: string | null;
  res?: FastifyReply;
}

export function createContext(opts: ContextOptions) {
  return {
    noteService: opts.noteService,
    folderService: opts.folderService,
    authService: opts.authService,
    tagService: opts.tagService,
    userId: opts.userId,
    res: opts.res,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
