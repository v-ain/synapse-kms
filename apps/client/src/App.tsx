import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { NotesList } from './components/NotesList';
import { NoteViewer } from './components/NoteViewer';
import { AuthForm } from './components/AuthForm';
import { useUIStore } from './store';
import { Sheet, SheetContent, SheetTrigger } from './components/ui/sheet';
import { Button } from './components/ui/button';
import { Menu, Brain, LogOut, CloudCheck } from 'lucide-react';
import { Separator } from './components/ui/separator';

export default function App() {
  const [isAuthed, setIsAuthed] = useState(false);
  const { activeNoteId, setActiveNote } = useUIStore();

  if (!isAuthed) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <AuthForm onAuthSuccess={() => setIsAuthed(true)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50 overflow-hidden">
      {/* 👑 ГЛОБАЛЬНАЯ ШАПКА ПРИЛОЖЕНИЯ (Теперь и на десктопе, и на мобилках!) */}
      <header className="flex items-center justify-between px-4 md:px-6 h-14 border-b border-slate-200 bg-slate-50/50 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/50 shrink-0 z-30">
        {/* Левая часть шапки: Логотип и Мобильное меню */}
        <div className="flex items-center gap-3">
          {/* Мобильная кнопка-бургер (скрыта на десктопе через md:hidden) */}
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Открыть меню</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="p-0 w-72 h-full border-r dark:border-slate-800"
              >
                <Sidebar />
              </SheetContent>
            </Sheet>
          </div>

          {/* Официальный сквозной Логотип проекта Synapse KMS 🧠 */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900 shrink-0 shadow-sm">
              <Brain className="h-4 w-4" />
            </div>
            <span className="font-bold text-sm md:text-base tracking-tight">
              Synapse KMS
            </span>
          </div>

          <Separator
            orientation="vertical"
            className="hidden md:block h-4 mx-2"
          />

          {/* Статус синхронизации на десктопе */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <CloudCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>Облако синапсов активно</span>
          </div>
        </div>

        {/* Правая часть шапки: Навигация / Кнопка Выхода */}
        <div className="flex items-center gap-2">
          {/* На мобилках выводим кнопку «Назад» к списку, если открыта заметка */}
          {activeNoteId && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs md:hidden"
              onClick={() => setActiveNote(null)}
            >
              ← К списку
            </Button>
          )}

          {/* Кнопка выхода из системы */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            onClick={() => setIsAuthed(false)}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Выйти</span>
          </Button>
        </div>
      </header>

      {/* 🏁 НИЖНЯЯ РАБОЧАЯ ОБЛАСТЬ (Разделена на панели под шапкой) */}
      <div className="flex flex-1 w-full h-full min-h-0 overflow-hidden relative">
        {/* 🖥️ ДЕСКТОПНЫЙ СИДЕНБАР */}
        <div className="hidden lg:block w-64 h-full shrink-0">
          <Sidebar />
        </div>

        {/* 📜 ЛЕНТА ЗАМЕТОК */}
        {/* Увеличили ширину на десктопе с w-80 на w-[400px] для комфортного чтения */}
        <div
          className={`
          w-full md:w-[400px] h-full border-r border-slate-200 dark:border-slate-800 shrink-0 flex flex-col min-h-0
          ${activeNoteId ? 'hidden md:block' : 'block'}
        `}
        >
          <NotesList />
        </div>

        {/* 📝 РЕДАКТОР / ПРОСМОТР ЗАМЕТКИ */}
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
  );
}
