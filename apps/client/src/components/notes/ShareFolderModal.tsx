import React, { useState } from 'react';
import { trpc } from '../../utils/trpc';
import { useShareFolder } from '../../hooks';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Share2, User, Shield, ShieldAlert } from 'lucide-react';

interface ShareFolderProps {
  folderId: string;
  folderTitle: string;
}

export function ShareFolderModal({ folderId, folderTitle }: ShareFolderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [accessLevel, setAccessLevel] = useState<'read' | 'write'>('read');

  const { mutate: shareFolder, isPending: isSharing } = useShareFolder();
  const { data: users, isLoading } = trpc.users.getAllForShare.useQuery(
    undefined,
    {
      enabled: isOpen, // Летит в базу только при открытии окна
    }
  );

  const handleShare = (targetEmail: string) => {
    shareFolder(
      { id: folderId, targetEmail, accessLevel },
      { onSuccess: () => setIsOpen(false) }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {/* Кнопка вызова на сайдбаре */}
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-900 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-150 shrink-0 mr-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      {/* Контент модалки с полной поддержкой светлой и темной тем */}
      <DialogContent className="sm:max-w-md bg-white border-slate-200 text-slate-900 dark:bg-slate-950 dark:border-slate-900 dark:text-slate-50 shadow-lg rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold leading-none tracking-tight text-slate-900 dark:text-slate-50">
            Поделиться папкой «{folderTitle}»
          </DialogTitle>
        </DialogHeader>

        {/* Селектор уровней доступа в стиле твоих карточек */}
        <div className="flex gap-2 p-1 rounded-lg bg-slate-100/70 border border-slate-200/50 dark:bg-slate-900 dark:border-slate-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => setAccessLevel('read')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md transition-all duration-150 ${
              accessLevel === 'read'
                ? 'bg-white text-indigo-600 border border-slate-200 shadow-sm dark:bg-slate-950 dark:text-indigo-400 dark:border-slate-800'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            <span>Только чтение</span>
          </button>

          <button
            type="button"
            onClick={() => setAccessLevel('write')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md transition-all duration-150 ${
              accessLevel === 'write'
                ? 'bg-white text-indigo-600 border border-slate-200 shadow-sm dark:bg-slate-950 dark:text-indigo-400 dark:border-slate-800'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Редактирование</span>
          </button>
        </div>

        {/* Список участников */}
        <div className="border border-slate-100 bg-slate-50/50 dark:border-slate-900 dark:bg-slate-950/50 rounded-xl max-h-60 overflow-y-auto p-1 space-y-1 scrollbar-thin">
          {isLoading && (
            <p className="p-4 text-xs font-medium text-slate-400 dark:text-slate-500 text-center animate-pulse">
              Загрузка доступных аккаунтов...
            </p>
          )}

          {users && users.length === 0 && (
            <p className="p-4 text-xs font-medium text-slate-400 dark:text-slate-500 text-center">
              Других аккаунтов в системе не найдено
            </p>
          )}

          {users?.map((user) => (
            <div
              key={user.id}
              className="group/item flex items-center justify-between p-2 rounded-lg border border-slate-100 bg-white hover:bg-slate-50 dark:border-slate-900/60 dark:bg-slate-950 dark:hover:bg-slate-900/50 transition-all duration-150"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 shrink-0">
                  <User className="h-3.5 w-3.5" />
                </div>
                <span className="font-semibold text-xs leading-none tracking-tight truncate text-slate-900 dark:text-slate-50">
                  {user.email}
                </span>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleShare(user.email)}
                disabled={isSharing}
                className="h-7 text-[11px] font-medium border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-400 dark:hover:border-indigo-900 transition-all duration-150"
              >
                Поделиться
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
