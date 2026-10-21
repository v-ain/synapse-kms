import { useUIStore } from '@/store';
import { CreateFolderForm } from '@/components/notes/CreateFolderForm';
import { TagCloud } from '@/components/tags/TagCloud';
import { Button } from '@/components/ui/button';
import { Inbox, Layers } from 'lucide-react';
import { FolderList } from '../folders/FolderList';

export function Sidebar() {
  const { activeFilter, setFilter } = useUIStore();

  return (
    <div className="flex flex-col h-full bg-slate-50/50 border-r border-slate-200 p-4 dark:bg-slate-900/50 dark:border-slate-800 transition-colors">
      {/* Системные фильтры */}
      <div className="space-y-1 mb-5 shrink-0">
        <Button
          variant={activeFilter === 'all' ? 'secondary' : 'ghost'}
          className="w-full justify-start gap-2.5 font-medium"
          onClick={() => setFilter('all')}
        >
          <Layers className="h-4 w-4 text-slate-500" />
          Все заметки
        </Button>
        <Button
          variant={activeFilter === 'inbox' ? 'secondary' : 'ghost'}
          className="w-full justify-start gap-2.5 font-medium"
          onClick={() => setFilter('inbox')}
        >
          <Inbox className="h-4 w-4 text-slate-500" />
          Входящие
        </Button>
      </div>

      {/* ЕДИНАЯ НАТИВНАЯ ЗОНА СКРОЛЛА (Папки + Теги крутятся бесшовно вместе) */}
      <div className="flex-1 overflow-y-auto min-h-0 -mx-2 px-2 space-y-4">
        {/* РАЗДЕЛ ПАПОК */}
        <FolderList />
        {/* РАЗДЕЛ ТЕГОВ */}
        <TagCloud />
      </div>
      {/* ИЗОЛИРОВАННАЯ ФОРМА СОЗДАНИЯ ПАПОК (Надежно прижата к самому низу) */}
      <CreateFolderForm />
    </div>
  );
}
