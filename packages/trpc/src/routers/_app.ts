import { router } from '../trpc.js';
import { notesRouter } from './notes.js';
import { authRouter } from './auth.js';
import { foldersRouter } from './folders.js';
import { tagsRouter } from './tags.js';
import { usersRouter } from './users.js';
import { notesLockRouter } from './note-lock.js';
import { systemEventRouter } from './events.js';

export const appRouter = router({
  auth: authRouter,
  notes: notesRouter,
  folders: foldersRouter,
  tags: tagsRouter,
  users: usersRouter,
  notesLock: notesLockRouter,
  events: systemEventRouter,
});

// Экспортируем ТИП роутера для фронтенда
export type AppRouter = typeof appRouter;
