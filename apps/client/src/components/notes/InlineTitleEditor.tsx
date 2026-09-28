import { useState, useEffect } from 'react';
import { useUpdateNote } from '@/hooks';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pencil, Check } from 'lucide-react';

interface InlineTitleEditorProps {
  noteId: string;
  currentTitle: string;
}

export function InlineTitleEditor({
  noteId,
  currentTitle,
}: InlineTitleEditorProps) {
  // Достаем обернутый метод и статус из нашего LWW-хука
  const { updateNote, isPending } = useUpdateNote();
  const [isEditing, setIsEditing] = useState(false);
  const [localTitle, setLocalTitle] = useState(currentTitle);

  // Синхронизируем локальный стейт при переключении заметок или изменении извне
  useEffect(() => {
    setLocalTitle(currentTitle);
    setIsEditing(false);
  }, [noteId, currentTitle]);

  const handleSave = () => {
    const trimmedTitle = localTitle.trim();
    const finalTitle = trimmedTitle || 'Без названия';

    // Если заголовок не изменился, просто закрываем инпут без сетевого запроса
    if (finalTitle === currentTitle) {
      setIsEditing(false);
      return;
    }

    // Быстрая проверка лимита длины (NOTE_LIMITS.TITLE_MAX обычно 255)
    if (finalTitle.length > 255) {
      console.warn(
        '[Validation Failed]: Заголовок слишком длинный (макс. 255 симв.)'
      );
      setLocalTitle(currentTitle);
      setIsEditing(false);
      return;
    }

    setIsEditing(false);

    // Отправляем только ID и изменившийся заголовок.
    // content не нужен, база обновит поля частично, а clientUpdatedAt подставится в хуке!
    updateNote({
      id: noteId,
      title: finalTitle,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setLocalTitle(currentTitle);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 max-w-xl flex-1 min-w-0">
        <Input
          type="text"
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="h-8 text-base font-bold text-slate-900 dark:text-slate-50 bg-slate-50/50"
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
          <Check className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="flex items-center gap-2 cursor-pointer rounded-md hover:bg-slate-50 dark:hover:bg-slate-900/50 px-1 py-0.5 -ml-1 transition-colors w-fit max-w-full flex-1 min-w-0"
    >
      <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 truncate">
        {currentTitle || 'Без названия'}
      </h2>

      <Pencil className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors shrink-0" />
    </div>
  );
}
