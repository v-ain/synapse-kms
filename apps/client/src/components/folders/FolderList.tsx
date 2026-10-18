import { useUIStore } from '@/store';
import { useDeleteFolder, useFolders } from '@/hooks';
import { Folder, Trash2 } from 'lucide-react';
import { ShareFolderModal } from '../notes/ShareFolderModal';
import { Button } from '@/components/ui/button';

export function FolderList() {
  const { activeFilter, activeFolderId, setActiveFolder } = useUIStore();
  const { data: folders, isLoading } = useFolders();
  const deleteFolderMutation = useDeleteFolder();
  return (
    <div>
      <div className="px-2 mb-2">
        <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Папки
        </h5>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400 p-2 animate-pulse">Загрузка...</p>
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
                      deleteFolderMutation.mutate({
                        id: folder.id,
                        clientUpdatedAt: new Date().toISOString(),
                      });
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>

                {/* Модалка сама содержит внутри себя кнопку-иконку и триггер Radix */}
                <ShareFolderModal
                  folderId={folder.id}
                  folderTitle={folder.title}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
