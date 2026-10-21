import { useUIStore } from '@/store'; // Вытаскиваем стор авторизации, чтобы проверять владельца
import { useDeleteFolder, useFolders } from '@/hooks';
import { Folder, FolderUsers, Trash2 } from 'lucide-react';
import { ShareFolderModal } from '../notes/ShareFolderModal';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';

export function FolderList() {
  const { activeFilter, activeFolderId, setActiveFolder } = useUIStore();
  const currentUserId = useAuthStore((state) => state.userId); // Берем ID текущего юзера
  const { data: folders, isLoading } = useFolders();
  const deleteFolderMutation = useDeleteFolder();

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
            const isActive =
              activeFolderId === folder.id && activeFilter === 'folder';

            // Флаг шеринга из FolderDTO (true, если создатель НЕ текущий юзер)
            const isShared = folder.isShared || folder.userId !== currentUserId;

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
                {/* Главная кнопка-ссылка на папку */}
                <Button
                  variant="ghost"
                  className="flex-1 justify-start gap-2.5 h-9 px-2.5 overflow-hidden text-ellipsis font-normal bg-transparent hover:bg-transparent dark:hover:bg-transparent"
                  onClick={() => setActiveFolder(folder.id)}
                >
                  {/* ВИЗУАЛЬНЫЙ МАРКЕР: Меняем иконку на основе статуса шеринга */}
                  {isShared ? (
                    <FolderUsers className="h-4 w-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
                  ) : (
                    <Folder className="h-4 w-4 shrink-0 text-slate-400" />
                  )}

                  <span className="truncate text-sm">{folder.title}</span>

                  {/* Счетчик аккуратно прижимаем вправо перед кнопками действий */}
                  <span className="text-[11px] text-slate-400 font-mono ml-auto pr-1 shrink-0">
                    {folder.notesCount}
                  </span>
                </Button>

                {/* КОМПАКТНЫЙ БЛОК ДЕЙСТВИЙ (Появляется по ховеру строки) */}
                <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-0.5 pr-1 shrink-0">
                  {/* Модалку шеринга показываем ТОЛЬКО если мы владелец папки */}
                  {!isShared && (
                    <ShareFolderModal
                      folderId={folder.id}
                      folderTitle={folder.title}
                    />
                  )}

                  {/* Кнопка удаления: показываем только для личных папок */}
                  {!isShared && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-destructive transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          confirm(`Удалить личную папку "${folder.title}"?`)
                        ) {
                          deleteFolderMutation.mutate({
                            id: folder.id,
                            clientUpdatedAt: new Date().toISOString(),
                          });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {/* Если папка ЧУЖАЯ (Shared), вместо удаления даем легкий маркер-подсказку */}
                  {isShared && (
                    <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded mr-1 font-medium select-none">
                      Доступ
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
