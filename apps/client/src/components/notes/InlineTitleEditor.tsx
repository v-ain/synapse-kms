import { useState } from 'react';
import { useUpdateNote } from '@/hooks';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pencil, Check, Loader2 } from 'lucide-react';

interface InlineTitleEditorProps {
  noteId: string;
  currentTitle: string;
}

export function InlineTitleEditor({
  noteId,
  currentTitle,
}: InlineTitleEditorProps) {
  // Достаем метод и статус из обновленного LWW-хука
  const { updateNote, isPending } = useUpdateNote();
  const [isEditing, setIsEditing] = useState(false);

  // Благодаря key={id} на родителе стейт инициализируется ОДИН раз при монтировании!
  const [localTitle, setLocalTitle] = useState(currentTitle);
  const [isError, setIsError] = useState(false);

  const handleSave = () => {
    const trimmedTitle = localTitle.trim();
    const finalTitle = trimmedTitle || 'Без названия';

    // Если заголовок не изменился, просто закрываем режим редактирования
    if (finalTitle === currentTitle) {
      setIsEditing(false);
      setIsError(false);
      return;
    }

    if (finalTitle.length > 150) {
      console.warn(
        '[Validation Failed]: Заголовок слишком длинный (макс. 255 симв.)'
      );
      setIsError(true);
      return;
    }

    // Отправляем данные на сервер с колбэками новой модели
    updateNote(
      {
        id: noteId,
        title: finalTitle,
      },
      {
        onSuccess: () => {
          setIsEditing(false);
          setIsError(false);
        },
        onError: () => {
          setIsError(true);
          // При жесткой ошибке сети можно откатить заголовок к актуальному из пропсов
          setLocalTitle(currentTitle);
          setIsEditing(false);
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setLocalTitle(currentTitle);
      setIsEditing(false);
      setIsError(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 max-w-xl flex-1 min-w-0">
        <Input
          type="text"
          value={localTitle}
          onChange={(e) => {
            setLocalTitle(e.target.value);
            if (isError) setIsError(false);
          }}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={`h-8 text-base font-bold bg-slate-50/50 transition-colors ${
            isError
              ? 'border-destructive focus-visible:ring-destructive'
              : 'text-slate-900 dark:text-slate-50 border-slate-200 dark:border-slate-800 focus-visible:ring-slate-300'
          }`}
          autoFocus
          disabled={isPending}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-emerald-500 shrink-0"
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          ) : (
            <Check className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="flex items-center gap-2 cursor-pointer rounded-md hover:bg-slate-50 dark:hover:bg-slate-900/50 px-1 py-0.5 -ml-1 transition-colors w-fit max-w-full flex-1 min-w-0 group"
    >
      <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 truncate">
        {currentTitle || 'Без названия'}
      </h2>

      <Pencil className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors shrink-0" />
    </div>
  );
}
