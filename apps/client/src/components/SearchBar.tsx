import { useState, useEffect } from 'react';
import { useUIStore } from '../store';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const SearchBar = () => {
  const { setSearchQuery } = useUIStore();
  const [localValue, setLocalValue] = useState('');

  useEffect(() => {
    // Ждем 300мс после окончания ввода
    const timer = setTimeout(() => {
      setSearchQuery(localValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [localValue, setSearchQuery]);

  return (
    // Убираем внешние паддинги p-4 и border-b, так как родительский NotesList уже контролирует сетку
    <div className="relative w-full">
      {/* Иконка лупы слева внутри инпута */}
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />

      <Input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder="Поиск по контенту и заголовкам..."
        // pl-9 освобождает место под иконку лупы слева
        // pr-9 освобождает место под кнопку очистки справа
        className="w-full pl-9 pr-9 h-10 bg-slate-50/50 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-800 transition-colors focus-visible:ring-1 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-700"
      />

      {/* Удобная кнопка быстрой очистки поиска "X" (очень критично на мобилках!) */}
      {localValue && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full"
          onClick={() => setLocalValue('')}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Очистить поиск</span>
        </Button>
      )}
    </div>
  );
};
