import React, { useState } from 'react';
import { useUIStore } from '../store';
import { useNotes, useNote, useArchiveNote, useAttachTag } from '../hooks';
import { NoteEditor } from './NoteEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Archive, Brain, Loader2, Plus, Tag as TagIcon } from 'lucide-react';
import { InlineTitleEditor } from './InlineTitleEditor';

export function NoteViewer() {
  const { activeNoteId } = useUIStore();
  const { data } = useNotes();
  const { data: fullNote, isLoading: contentLoading } = useNote(activeNoteId);
  const archiveNoteMutation = useArchiveNote();
  const attachTagMutation = useAttachTag();
  const [newTagName, setNewTagName] = useState('');

  // 🧬 Магия плоского развертывания страниц кэша
  const allNotesFlat = data?.pages.flatMap((page) => page.items) || [];
  const activeNote = allNotesFlat.find((n) => n.id === activeNoteId);

  const handleAttachTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim() || !activeNoteId) return;
    attachTagMutation.mutate(
      { noteId: activeNoteId, tagName: newTagName.trim() },
      {
        onSuccess: () => setNewTagName(''),
      }
    );
  };

  // 🌌 Экран заглушки (Если заметка не выбрана)
  if (!activeNoteId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-slate-50/30 dark:bg-slate-900/10">
        <div className="rounded-full bg-slate-100 p-4 mb-4 dark:bg-slate-900 animate-pulse">
          <Brain className="h-10 w-10 text-slate-400 dark:text-slate-600" />
        </div>
        <h4 className="text-base font-semibold tracking-tight text-slate-800 dark:text-slate-200">
          Среда Synapse KMS готова к работе
        </h4>
        <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mt-1.5 leading-relaxed">
          Выберите любую заметку из центральной ленты для открытия графа знаний
          и управления синапсами.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 p-6">
      {/* ВЕРХНЯЯ ПАНЕЛЬ: Заголовок, версия и кнопка Архива */}
      <div className="space-y-1 mb-4 shrink-0">
        <div className="flex items-start justify-between gap-4">
          {/* Подключаем атомарный инлайн-редактор */}
          <InlineTitleEditor
            noteId={activeNoteId}
            currentTitle={activeNote?.title || 'Без названия'}
            currentContent={fullNote?.content || ''}
            currentVersion={activeNote?.version || 1}
          />
          <Button
            variant="destructive"
            size="sm"
            className="h-8 gap-1.5 shrink-0"
            onClick={() => {
              if (confirm('Удалить заметку в архив?')) {
                archiveNoteMutation.mutate({ id: activeNoteId });
              }
            }}
          >
            <Archive className="h-3.5 w-3.5" />В архив
          </Button>
        </div>

        <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
          Системная версия:{' '}
          <span className="font-mono text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded">
            v{activeNote?.version}
          </span>
        </p>
      </div>

      {/* 🏷️ ПАНЕЛЬ УПРАВЛЕНИЯ ТЕГАМИ */}
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
              <Loader2 className="h-3 w-3 animate-spin" />
              Привязка...
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              Добавить тег
            </>
          )}
        </Button>
      </form>

      <Separator className="mb-4 shrink-0" />

      {/* 📝 ОБЛАСТЬ КОНТЕНТА И РЕДАКТОРА С СОБСТВЕННЫМ СКРОЛЛОМ */}
      <div className="flex-1 overflow-y-auto min-h-0 -mx-2 px-2">
        <div className="space-y-4 pb-6 pr-2">
          {contentLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 italic py-4">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Синхронизация синапса знаний с Podman...
            </div>
          ) : (
            /* Рендерим ТОЛЬКО редактор, он теперь сам отображает и контролирует текст */
            <NoteEditor note={fullNote} />
          )}
        </div>
      </div>
    </div>
  );
}
