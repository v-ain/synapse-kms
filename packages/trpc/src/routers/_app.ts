import { router } from '../trpc.js';
import { notesRouter } from './notes.js';
import { authRouter } from './auth.js';
import { foldersRouter } from './folders.js';
import { tagsRouter } from './tags.js';
import { usersRouter } from './users.js';

export const appRouter = router({
  auth: authRouter,
  notes: notesRouter,
  folders: foldersRouter,
  tags: tagsRouter,
  users: usersRouter,
});

// Экспортируем ТИП роутера для фронтенда
export type AppRouter = typeof appRouter;
