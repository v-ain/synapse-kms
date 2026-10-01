import { useState } from 'react';
import { useNote, useArchiveNote, useAttachTag } from '@/hooks';
import { NoteEditor } from './NoteEditor';
import { InlineTitleEditor } from './InlineTitleEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Archive, Loader2, Plus, Tag as TagIcon } from 'lucide-react';

interface NoteWorkspaceProps {
  noteId: string;
}

export function NoteWorkspace({ noteId }: NoteWorkspaceProps) {
  const { data: fullNote, isLoading: contentLoading } = useNote(noteId);
  const archiveNoteMutation = useArchiveNote();
  const attachTagMutation = useAttachTag();
  const [newTagName, setNewTagName] = useState('');

  const handleAttachTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    attachTagMutation.mutate(
      { noteId, tagName: newTagName.trim() },
      { onSuccess: () => setNewTagName('') }
    );
  };

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

          <Button
            variant="destructive"
            size="sm"
            className="h-8 gap-1.5 shrink-0"
            onClick={() => {
              if (confirm('Удалить заметку в архив?')) {
                archiveNoteMutation.mutate({ id: fullNote.id });
              }
            }}
          >
            <Archive className="h-3.5 w-3.5" /> В архив
          </Button>
        </div>

        <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
          Последняя синхронизация:{' '}
          <span className="font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
            {lastSavedTime}
          </span>
        </p>
      </div>

      {/* УПРАВЛЕНИЕ ТЕГАМИ */}
      <form
        onSubmit={handleAttachTag}
        className="flex items-center gap-2 mb-4 shrink-0"
      >
        <div className="relative w-full max-w-[200px]">
          <TagIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            type="text"
            placeholder="Новый хэштег..."
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            disabled={attachTagMutation.isPending}
            className="pl-8 h-8 text-xs bg-slate-50/50 dark:bg-slate-900/50"
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          className="h-8 text-xs gap-1"
          disabled={attachTagMutation.isPending}
        >
          {attachTagMutation.isPending ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Привязка...
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" /> Добавить тег
            </>
          )}
        </Button>
      </form>

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
