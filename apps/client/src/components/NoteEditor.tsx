import { useState, useEffect } from 'react';
import { useUpdateNote } from '../hooks.js';
import { Textarea } from '@/components/ui/textarea';
import { CloudLightning, CloudCheck, Loader2 } from 'lucide-react';

interface EditorProps {
  note:
    | { id: string; content: string; version: number; title: string }
    | null
    | undefined;
}

export const NoteEditor = ({ note }: EditorProps) => {
  // Безопасно обрабатываем null/undefined на случай, если данные еще грузятся
  const [text, setText] = useState(note?.content || '');
  const updateNoteMutation = useUpdateNote();

  // Синхронизируем локальный стейт при переключении заметок
  useEffect(() => {
    if (note) {
      setText(note.content);
    }
  }, [note?.id, note?.content]);

  // Эффект дебаунс-автосохранения контента
  useEffect(() => {
    if (!note || text === note.content) return;

    const timer = setTimeout(() => {
      updateNoteMutation.mutate({
        id: note.id,
        version: note.version,
        content: text,
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [text, note?.id, note?.version, note?.content]);

  if (!note) return null;

  // Считаем слова на лету
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex flex-col w-full space-y-2">
      {/* 📝 РЕДАКТОР: Растягивается по контенту, убираем дефолтные рамки */}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Начните писать ваши мысли здесь..."
        className="w-full min-h-[300px] p-4 bg-slate-50/30 dark:bg-slate-900/30 border-slate-100 dark:border-slate-900 focus-visible:ring-1 focus-visible:ring-slate-300 dark:focus-visible:ring-slate-800 font-mono text-sm leading-relaxed resize-y"
      />

      {/* 📊 СТАТУС-БАР: Компактный, информативный, в стиле нашей дизайн-системы */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-slate-50 border border-slate-100 text-[11px] font-medium text-slate-500 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 select-none">
        {/* Индикатор статуса синхронизации с базой */}
        <div className="flex items-center gap-1.5">
          {updateNoteMutation.isPending ? (
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

        {/* Статистика заметки */}
        <div className="flex items-center gap-3 font-mono">
          <span>
            Слов:{' '}
            <strong className="text-slate-700 dark:text-slate-300">
              {wordCount}
            </strong>
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span>
            Версия:{' '}
            <strong className="text-slate-700 dark:text-slate-300">
              v{note.version}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
};
