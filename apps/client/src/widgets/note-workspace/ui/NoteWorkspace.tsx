import { Loader2 } from 'lucide-react';
import { useNote } from '@/entities/note';
import { InlineTitleEditor, NoteEditor } from '@/features/note/edit';
import { ArchiveNoteButton } from '@/features/note/archive';
import { AttachTagForm } from '@/features/note/attach-tag';
import { Separator } from '@/shared/ui/separator';

interface NoteWorkspaceProps {
  noteId: string;
}

export function NoteWorkspace({ noteId }: NoteWorkspaceProps) {
  const { data: fullNote, isLoading: contentLoading } = useNote(noteId);

  if (contentLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 italic">
        <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
        <span>Синхронизация синапса знаний с Podman...</span>
      </div>
    );
  }

  if (!fullNote) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 italic">
        <span>Заметка не найдена или доступ ограничен</span>
      </div>
    );
  }

  const lastSavedTime = fullNote.clientUpdatedAt
    ? new Date(fullNote.clientUpdatedAt).toLocaleString()
    : 'Неизвестно';

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 p-6 animate-in fade-in duration-200">
      {/* ВЕРХНЯЯ ПАНЕЛЬ */}
      <div className="space-y-1 mb-4 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <InlineTitleEditor
            noteId={fullNote.id}
            currentTitle={fullNote.title}
            key={fullNote.id}
          />

          <ArchiveNoteButton noteId={fullNote.id} noteTitle={fullNote.title} />
        </div>

        <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
          Последняя синхронизация:{' '}
          <span className="font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
            {lastSavedTime}
          </span>
        </p>
      </div>

      {/* УПРАВЛЕНИЕ ТЕГАМИ */}
      <AttachTagForm noteId={noteId} />

      <Separator className="mb-4 shrink-0" />

      {/* ОБЛАСТЬ РЕДАКТОРА */}
      <div className="flex-1 overflow-y-auto min-h-0 -mx-2 px-2">
        <div className="space-y-4 pb-6 pr-2">
          <NoteEditor note={fullNote} key={fullNote.id} />
        </div>
      </div>
    </div>
  );
}
