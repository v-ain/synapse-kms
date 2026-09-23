import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { NotesList } from './components/NotesList';
import { NoteViewer } from './components/NoteViewer';
import { AuthForm } from './components/AuthForm';
import { Header } from './components/Header'; // 👈 Наша новая шапка
import { ThemeProvider } from './components/ThemeProvider'; // 👈 Провайдер тем
import { useUIStore } from './store';

export default function App() {
  const [isAuthed, setIsAuthed] = useState(false);
  const { activeNoteId } = useUIStore();

  if (!isAuthed) {
    return (
      <ThemeProvider defaultTheme="system" storageKey="synapse-ui-theme">
        <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
          <AuthForm onAuthSuccess={() => setIsAuthed(true)} />
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider defaultTheme="system" storageKey="synapse-ui-theme">
      <div className="flex flex-col h-screen w-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50 overflow-hidden transition-colors duration-200">
        {/* ДЕКОМПОЗИРОВАННЫЙ HEADER С ПОДДЕРЖКОЙ ТЕМЫ */}
        <Header onLogout={() => setIsAuthed(false)} />

        {/* НИЖНЯЯ РАБОЧАЯ ОБЛАСТЬ */}
        <div className="flex flex-1 w-full h-full min-h-0 overflow-hidden relative">
          {/* ДЕСКТОПНЫЙ СИДЕНБАР */}
          <div className="hidden lg:block w-64 h-full shrink-0">
            <Sidebar />
          </div>

          {/* ЛЕНТА ЗАМЕТОК */}
          <div
            className={`
            w-full md:w-[400px] h-full border-r border-slate-200 dark:border-slate-800 shrink-0 flex flex-col min-h-0
            ${activeNoteId ? 'hidden md:block' : 'block'}
          `}
          >
            <NotesList />
          </div>

          {/* РЕДАКТОР / ПРОСМОТР ЗАМЕТКИ */}
          <div
            className={`
            flex-1 h-full min-w-0 flex flex-col min-h-0
            ${!activeNoteId ? 'hidden md:block' : 'block'}
          `}
          >
            <NoteViewer />
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}
