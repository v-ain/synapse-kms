import { useUIStore } from '../store';
import { useFolders, useDeleteFolder } from '../hooks';
import { CreateFolderForm } from './CreateFolderForm';
import { TagCloud } from './TagCloud';
import { Button } from './ui/button';
import { Folder, Inbox, Layers, Trash2 } from 'lucide-react';

export function Sidebar() {
  const { activeFilter, activeFolderId, setActiveFolder, setFilter } =
    useUIStore();
  const { data: folders, isLoading } = useFolders();
  const deleteFolderMutation = useDeleteFolder();

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
        <div>
          <div className="px-2 mb-2">
            <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Папки
            </h5>
          </div>

          {isLoading ? (
            <p className="text-sm text-slate-400 p-2 animate-pulse">
              Загрузка...
            </p>
          ) : (
            <div className="space-y-1 pr-1">
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
                        ({folder.notesCount})
                      </span>
                    </Button>

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
        </div>

        {/* РАЗДЕЛ ТЕГОВ */}
        <TagCloud />
      </div>

      {/* ИЗОЛИРОВАННАЯ ФОРМА СОЗДАНИЯ ПАПОК (Надежно прижата к самому низу) */}
      <CreateFolderForm />
    </div>
  );
}
