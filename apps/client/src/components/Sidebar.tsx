// apps/client/src/components/Sidebar.tsx
import React, { useState } from 'react';
import { useUIStore } from '../store';
import { useFolders, useCreateFolder, useDeleteFolder } from '../hooks';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import {
  Brain,
  Folder,
  FolderPlus,
  Inbox,
  Layers,
  Trash2,
  X,
} from 'lucide-react';

export function Sidebar() {
  const { activeFilter, activeFolderId, setActiveFolder, setFilter } =
    useUIStore();
  const { data: folders, isLoading } = useFolders();
  const createFolderMutation = useCreateFolder();
  const deleteFolderMutation = useDeleteFolder();
  const [newFolderTitle, setNewFolderTitle] = useState('');

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderTitle.trim()) return;
    createFolderMutation.mutate(
      { title: newFolderTitle },
      {
        onSuccess: () => setNewFolderTitle(''),
      }
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 border-r border-slate-200 p-4 dark:bg-slate-900/50 dark:border-slate-800">
      {/* Системные фильтры */}
      <div className="space-y-1 mb-6">
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

      {/* Заголовок папок */}
      <div className="px-2 mb-2">
        <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Папки
        </h5>
      </div>

      {/* Изолированная область скролла папок */}
      <ScrollArea className="flex-1 -mx-2 px-2">
        {isLoading ? (
          <p className="text-sm text-slate-400 p-2 animate-pulse">
            Загрузка...
          </p>
        ) : (
          <div className="space-y-1 pr-2">
            {folders?.map((folder) => {
              const isActive =
                activeFolderId === folder.id && activeFilter === 'folder';
              return (
                <div
                  key={folder.id}
                  className="group flex items-center justify-between rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    className="flex-1 justify-start gap-2.5 overflow-hidden text-ellipsis truncate font-normal"
                    onClick={() => setActiveFolder(folder.id)}
                  >
                    <Folder className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate">{folder.title}</span>
                    <span className="text-xs text-slate-400 ml-auto shrink-0 font-mono">
                      ({folder.notes_count})
                    </span>
                  </Button>

                  {/* Кнопка удаления появляется элегантно при наведении (на десктопе) или доступна всегда */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-destructive opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mr-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Удалить папку?')) {
                        deleteFolderMutation.mutate({ id: folder.id });
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Форма создания новой папки (прижата к низу) */}
      <form
        onSubmit={handleCreateFolder}
        className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2"
      >
        <Input
          type="text"
          placeholder="Новая папка..."
          value={newFolderTitle}
          onChange={(e) => setNewFolderTitle(e.target.value)}
          className="h-9 bg-white dark:bg-slate-950"
        />
        <Button
          type="submit"
          size="sm"
          className="w-full gap-1.5 h-9 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          <FolderPlus className="h-3.5 w-3.5" />
          Создать папку
        </Button>
      </form>
    </div>
  );
}
