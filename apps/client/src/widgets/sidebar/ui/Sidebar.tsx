import { Inbox, Layers, Trash2 } from 'lucide-react';
import { FolderList } from '@/entities/folder';
import { TagCloud } from '@/entities/tag';
import { useNoteFiltersStore } from '@/features/note/filter';
import { CreateFolderForm } from '@/features/folder/create';
import { ShareFolderModal } from '@/features/folder/share';
import { useDeleteFolder } from '@/features/folder/delete';
import { Button } from '@/shared/ui/button';

export function Sidebar() {
  const {
    activeFilter,
    activeFolderId,
    activeTagName,
    setFilter,
    setActiveFolder,
    setActiveTag,
  } = useNoteFiltersStore();

  const { deleteFolder } = useDeleteFolder({
    onDeleted: () => setFilter('all'),
  });

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

      {/* ЕДИНАЯ НАТИВНАЯ ЗОНА СКРОЛЛА */}
      <div className="flex-1 overflow-y-auto min-h-0 -mx-2 px-2 space-y-4">
        <FolderList
          selectedFolderId={activeFilter === 'folder' ? activeFolderId : null}
          onSelectFolder={setActiveFolder}
          renderActions={(folder) => (
            <>
              <ShareFolderModal
                folderId={folder.id}
                folderTitle={folder.title}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-400 hover:text-destructive transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Удалить личную папку "${folder.title}"?`)) {
                    deleteFolder(folder.id);
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        />

        <TagCloud
          selectedTagName={activeFilter === 'tag' ? activeTagName : null}
          onSelectTag={setActiveTag}
        />
      </div>

      <CreateFolderForm />
    </div>
  );
}
