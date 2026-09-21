import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { NotesList } from './components/NotesList';
import { NoteViewer } from './components/NoteViewer';
import { AuthForm } from './components/AuthForm';
import { useUIStore } from './store'; // Импортируем стейт UI, чтобы знать, выбрана ли заметка
import { Sheet, SheetContent, SheetTrigger } from './components/ui/sheet';
import { Button } from './components/ui/button';
import { Brain, Menu } from 'lucide-react';

export default function App() {
  const [isAuthed, setIsAuthed] = useState(false);

  // Допускаем, что в вашем zustand-сторе есть ID активной заметки и функция сброса
  const { activeNoteId, setActiveNote } = useUIStore();

  if (!isAuthed) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <AuthForm onAuthSuccess={() => setIsAuthed(true)} />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50 overflow-hidden">
      {/* 🖥️ ДЕСКТОПНЫЙ СИДЕНБАР: виден только на экранах от md (768px) и шире */}
      <div className="hidden md:block w-64 h-full shrink-0">
        <Sidebar />
      </div>

      {/* 📱 МОБИЛЬНЫЙ ИНТЕРФЕЙС И РАБОЧИЕ ПАНЕЛИ */}
      <div className="flex flex-col flex-1 h-full min-w-0 relative">
        {/* ВЕРХНЯЯ МОБИЛЬНАЯ ШАПКА: видна только на смартфонах/планшетах */}
        <header className="flex md:hidden items-center justify-between px-4 h-14 border-b border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-2.5">
            {/* Шторка shadcn/ui, куда мы заворачиваем Sidebar целиком */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Открыть меню папок</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="p-0 w-72 h-full border-r dark:border-slate-800"
              >
                {/* Рендерим тот же самый Sidebar внутрь мобильной шторки */}
                <Sidebar />
              </SheetContent>
            </Sheet>
            {/* Наш сквозной логотип */}
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900 shrink-0">
              <Brain className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold text-sm tracking-tight">
              Synapse KMS
            </span>
          </div>

          {/* Если на мобилке открыта заметка, выводим кнопку возврата к списку */}
          {activeNoteId && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setActiveNote(null)}
            >
              ← К списку
            </Button>
          )}
        </header>

        {/* ОСНОВНАЯ СЕТКА КОНТЕНТА */}
        <main className="flex flex-1 h-full min-w-0 overflow-hidden relative">
          {/* ЛЕНТА ЗАМЕТОК */}
          {/* На мобилках скрывается, если просматривается конкретная заметка */}
          <div
            className={`
            w-full md:w-80 h-full border-r border-slate-200 dark:border-slate-800 shrink-0 flex flex-col min-h-0
            ${activeNoteId ? 'hidden md:block' : 'block'}
           `}
          >
            <NotesList />
          </div>

          {/* РЕДАКТОР / ПРОСМОТР ЗАМЕТКИ */}
          {/* На мобилках скрывается, если заметка НЕ выбрана (показываем пустой экран или список) */}
          <div
            className={`
            flex-1 h-full min-w-0 flex flex-col min-h-0
            ${!activeNoteId ? 'hidden md:block' : 'block'}
          `}
          >
            <NoteViewer />
          </div>
        </main>
      </div>
    </div>
  );
}
