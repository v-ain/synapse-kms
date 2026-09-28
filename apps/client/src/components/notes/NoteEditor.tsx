import { useState, useEffect } from 'react';
import { useUpdateNote } from '@/hooks.js';
import { Textarea } from '@/components/ui/textarea';
import { CloudCheck, Loader2, AlertCircle } from 'lucide-react';
import type { Note } from '@synapse-kms/shared';

interface EditorProps {
  note: Note | null | undefined;
}

export const NoteEditor = ({ note }: EditorProps) => {
  const [text, setText] = useState(note?.content || '');
  const [error, setError] = useState<string | null>(null);

  // Достаем обернутый метод updateNote из нашего кастомного хука
  const { updateNote, isPending } = useUpdateNote();

  // Синхронизируем локальный стейт при переключении заметок
  useEffect(() => {
    if (note) {
      setText(note.content);
      setError(null);
    }
  }, [note?.id, note?.content]);

  // Эффект дебаунс-автосохранения контента
  useEffect(() => {
    if (!note || text === note.content) return;

    const timer = setTimeout(() => {
      // 🧬 Прямая и быстрая проверка лимита без оверхеда на Zod-парсинг полной схемы
      // (Лимит в 5000 взят из вашей старой схемы валидации текста)
      if (text.length > 5000) {
        setError('CONTENT_TOO_LONG: Текст превышает лимит в 5000 символов');
        return;
      }

      setError(null);

      // Вызываем наш оптимизированный метод. Дата подмешается автоматически!
      updateNote({
        id: note.id,
        content: text,
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [text, note?.id, note?.content]); // Больше никакой зависимости от версии!

  if (!note) return null;

  // Считаем слова на лету
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // Форматируем время сохранения для статус-бара
  const lastSavedTime = note.clientUpdatedAt
    ? new Date(note.clientUpdatedAt).toLocaleTimeString()
    : '--:--:--';

  return (
    <div className="flex flex-col w-full space-y-2">
      {/* РЕДАКТОР */}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Начните писать ваши мысли здесь..."
        className={`w-full min-h-[300px] p-4 bg-slate-50/30 dark:bg-slate-900/30 border-slate-100 dark:border-slate-900 focus-visible:ring-1 font-mono text-sm leading-relaxed resize-y transition-colors ${
          error
            ? 'border-destructive focus-visible:ring-destructive dark:border-destructive'
            : 'focus-visible:ring-slate-300 dark:focus-visible:ring-slate-800'
        }`}
      />

      {/* СТАТУС-БАР */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-slate-50 border border-slate-100 text-[11px] font-medium text-slate-500 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 select-none">
        {/* Левая часть: Статус синхронизации или Ошибка валидации */}
        <div className="flex items-center gap-1.5">
          {error ? (
            <div className="flex items-center gap-1 text-destructive font-semibold animate-in fade-in duration-150">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : isPending ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="text-slate-700 dark:text-slate-300 font-semibold animate-pulse">
                Синхронизация синапса...
              </span>
            </>
          ) : (
            <>
              <CloudCheck className="h-3 w-3 text-emerald-500" />
              <span>Сохранено в KMS</span>
            </>
          )}
        </div>

        {/* Правая часть: Статистика заметки */}
        <div className="flex items-center gap-3 font-mono">
          <span>
            Слов:{' '}
            <strong className="text-slate-700 dark:text-slate-300">
              {wordCount}
            </strong>
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span>
            Сохранено:{' '}
            <strong className="text-slate-700 dark:text-slate-300">
              {lastSavedTime}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
};
