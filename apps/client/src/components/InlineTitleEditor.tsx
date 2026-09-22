import { useState, useEffect } from 'react';
import { useUpdateNote } from '../hooks';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Pencil, Check } from 'lucide-react';

interface InlineTitleEditorProps {
  noteId: string;
  currentTitle: string;
  currentContent: string;
  currentVersion: number;
}

export function InlineTitleEditor({
  noteId,
  currentTitle,
  currentContent,
  currentVersion,
}: InlineTitleEditorProps) {
  const updateNoteMutation = useUpdateNote();
  const [isEditing, setIsEditing] = useState(false);
  const [localTitle, setLocalTitle] = useState(currentTitle);

  // Синхронизируем локальный текст при смене активной заметки в ленте
  useEffect(() => {
    setLocalTitle(currentTitle);
    setIsEditing(false);
  }, [noteId, currentTitle]);

  const handleSave = () => {
    setIsEditing(false);

    // Если заголовок не менялся — не дёргаем сервер
    if (localTitle.trim() === currentTitle) return;

    updateNoteMutation.mutate({
      id: noteId,
      version: currentVersion, // Отправляем версию для оптимистичного замка
      title: localTitle.trim() || 'Без названия',
      content: currentContent, // Сохраняем текущее тело заметки
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
          disabled={updateNoteMutation.isPending}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-emerald-500 shrink-0"
          onClick={handleSave}
          disabled={updateNoteMutation.isPending}
        >
          <Check className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      // Убираем group, так как иконка теперь управляется самостоятельно
      className="flex items-center gap-2 cursor-pointer rounded-md hover:bg-slate-50 dark:hover:bg-slate-900/50 px-1 py-0.5 -ml-1 transition-colors w-fit max-w-full flex-1 min-w-0"
    >
      <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50 truncate">
        {currentTitle || 'Без названия'}
      </h2>

      {/* ✏️ Карандаш теперь виден ВСЕГДА. Наведение мыши плавно делает его чуть темнее/ярче */}
      <Pencil className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors shrink-0" />
    </div>
  );
}
