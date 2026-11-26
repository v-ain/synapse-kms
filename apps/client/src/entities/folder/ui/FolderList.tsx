import type { ReactNode } from 'react';
import { Folder, FolderUsers } from 'lucide-react';
import { useFolders } from '../api/queries';
import { Button } from '@/shared/ui/button';

interface FolderListProps {
  selectedFolderId?: string | null;
  onSelectFolder?: (folderId: string) => void;
  renderActions?: (folder: {
    id: string;
    title: string;
    isOwner: boolean;
  }) => ReactNode;
}

export function FolderList({
  selectedFolderId,
  onSelectFolder,
  renderActions,
}: FolderListProps) {
  const { data: folders, isLoading } = useFolders();

  return (
    <div className="w-full">
      <div className="px-2 mb-2">
        <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider select-none">
          Папки
        </h5>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400 p-2 animate-pulse">Загрузка...</p>
      ) : (
        <div className="space-y-0.5 pr-1">
          {folders?.map((folder) => {
            const isActive = selectedFolderId === folder.id;
            const isShared = folder.accessLevel !== 'owner';
            const isOwner = folder.accessLevel === 'owner';

            return (
              <div
                key={folder.id}
                className={`group flex items-center justify-between rounded-md transition-colors relative
                  ${
                    isActive
                      ? 'bg-slate-100 dark:bg-slate-800 text-foreground'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-900 text-muted-foreground hover:text-foreground'
                  }`}
              >
                <Button
                  variant="ghost"
                  className="flex-1 justify-start gap-2.5 h-9 px-2.5 overflow-hidden text-ellipsis font-normal bg-transparent hover:bg-transparent dark:hover:bg-transparent"
                  onClick={() => onSelectFolder?.(folder.id)}
                >
                  {isShared ? (
                    <FolderUsers className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
                  ) : (
                    <Folder className="h-4 w-4 shrink-0 text-slate-400" />
                  )}

                  <span className="truncate text-sm">{folder.title}</span>

                  <span className="text-[11px] text-slate-400 font-mono ml-auto pr-1 shrink-0">
                    {folder.notesCount}
                  </span>
                </Button>

                <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-0.5 pr-1 shrink-0">
                  {isOwner &&
                    renderActions?.({
                      id: folder.id,
                      title: folder.title,
                      isOwner,
                    })}

                  {isShared && (
                    <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded mr-1 font-medium select-none">
                      {folder.accessLevel === 'write' ? 'Правка' : 'Просмотр'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
