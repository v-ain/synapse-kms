import { Archive } from 'lucide-react';
import { useArchiveNote } from '../api/useArchiveNote';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';

interface ArchiveNoteButtonProps {
  noteId: string;
  noteTitle?: string;
}

export function ArchiveNoteButton({
  noteId,
  noteTitle,
}: ArchiveNoteButtonProps) {
  const archiveNoteMutation = useArchiveNote();

  return (
    <ConfirmDialog
      title="Переместить заметку в архив?"
      description={
        noteTitle
          ? `Заметка «${noteTitle}» скроется из основного списка, но останется доступной в архиве.`
          : 'Заметка скроется из основного списка, но останется доступной в архиве.'
      }
      confirmText="В архив"
      isPending={archiveNoteMutation.isPending}
      onConfirm={() => archiveNoteMutation.mutate({ id: noteId })}
      trigger={
        <Button
          variant="destructive"
          size="sm"
          className="h-8 gap-1.5 shrink-0"
        >
          <Archive className="h-3.5 w-3.5" /> В архив
        </Button>
      }
    />
  );
}
