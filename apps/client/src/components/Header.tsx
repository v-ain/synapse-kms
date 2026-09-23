import { useUIStore } from '../store';
import { Sidebar } from './Sidebar';
import { useTheme } from './ThemeProvider';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Menu,
  Brain,
  LogOut,
  CloudCheck,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface HeaderProps {
  onLogout: () => void;
}

export function Header({ onLogout }: HeaderProps) {
  const { activeNoteId, setActiveNote } = useUIStore();
  const { theme, setTheme } = useTheme();

  return (
    <header className="flex items-center justify-between px-4 md:px-6 h-14 border-b border-slate-200 bg-slate-50/50 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/50 shrink-0 z-30 transition-colors">
      {/* Левая часть: Бургер, Логотип Brain и Статус */}
      <div className="flex items-center gap-3">
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
          className="hidden lg:block h-4 mx-2"
        />

        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          <CloudCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Облако синапсов активно</span>
        </div>
      </div>

      {/* Правая часть: Назад, Переключатель темы и Выход */}
      <div className="flex items-center gap-2">
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

        {/* ПЕРЕКЛЮЧАТЕЛЬ ТЁМНОЙ ТЕМЫ */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-50"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Переключить тему</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="dark:border-slate-800">
            <DropdownMenuItem
              onClick={() => setTheme('light')}
              className="gap-2 text-xs cursor-pointer"
            >
              <Sun className="h-3.5 w-3.5" /> Светлая
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTheme('dark')}
              className="gap-2 text-xs cursor-pointer"
            >
              <Moon className="h-3.5 w-3.5" /> Тёмная
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setTheme('system')}
              className="gap-2 text-xs cursor-pointer"
            >
              <Monitor className="h-3.5 w-3.5" /> Системная
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Кнопка выхода */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          onClick={onLogout}
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Выйти</span>
        </Button>
      </div>
    </header>
  );
}
