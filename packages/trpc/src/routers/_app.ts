import { router } from '../trpc.js';
import { notesRouter } from './notes.js';
// Сюда позже добавим folderRouter

export const appRouter = router({
  notes: notesRouter,
});

// Экспортируем ТИП роутера для фронтенда
export type AppRouter = typeof appRouter;
