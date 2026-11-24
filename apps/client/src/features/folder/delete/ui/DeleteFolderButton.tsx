import { Trash2 } from 'lucide-react';
import { useDeleteFolder } from '../api/useDeleteFolder';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';

interface DeleteFolderButtonProps {
  folderId: string;
  folderTitle: string;
  onDeleted?: () => void;
}

export function DeleteFolderButton({
  folderId,
  folderTitle,
  onDeleted,
}: DeleteFolderButtonProps) {
  const { deleteFolder, isPending } = useDeleteFolder({ onDeleted });

  return (
    <ConfirmDialog
      title={`Удалить папку «${folderTitle}»?`}
      description="Папка будет удалена безвозвратно. Все заметки внутри неё не пропадут и перейдут в раздел «Входящие»."
      confirmText="Удалить папку"
      isPending={isPending}
      onConfirm={() => deleteFolder(folderId)}
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-slate-400 hover:text-destructive transition-colors"
          title="Удалить папку"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      }
    />
  );
}
