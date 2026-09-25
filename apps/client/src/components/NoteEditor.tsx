import { useState, useEffect } from 'react';
import { useUpdateNote } from '../hooks.js';
import { UpdateNotePayloadSchema } from '@synapse-kms/shared';
import { mapZodErrorToUi } from '../utils/errorMapper';
import { Textarea } from '@/components/ui/textarea';
import { CloudCheck, Loader2, AlertCircle } from 'lucide-react';
import type { Note } from '@synapse-kms/shared';

interface EditorProps {
  note: Note | null | undefined;
}

export const NoteEditor = ({ note }: EditorProps) => {
  const [text, setText] = useState(note?.content || '');
  const [error, setError] = useState<string | null>(null);
  const updateNoteMutation = useUpdateNote();

  // Синхронизируем локальный стейт при переключении заметок
  useEffect(() => {
    if (note) {
      setText(note.content);
      setError(null); // Сбрасываем ошибку при переходе на другую заметку
    }
  }, [note?.id, note?.content]);

  // Эффект дебаунс-автосохранения контента
  useEffect(() => {
    if (!note || text === note.content) return;

    const timer = setTimeout(() => {
      // 🧬 Валидируем данные на клиенте по Zod-схеме
      const validation = UpdateNotePayloadSchema.safeParse({
        id: note.id,
        version: note.version,
        content: text,
      });

      if (!validation.success) {
        // Если текст > 5000 символов, выводим ошибку в статус-бар и блокируем мутацию
        setError(mapZodErrorToUi(validation.error));
        return;
      }

      setError(null); // Если всё ок, убираем ошибку
      updateNoteMutation.mutate(validation.data);
    }, 1000);

    return () => clearTimeout(timer);
  }, [text, note?.id, note?.version, note?.content]);

  if (!note) return null;

  // Считаем слова на лету
  const wordCount = text.split(/\s+/).filter(Boolean).length;

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
          ) : updateNoteMutation.isPending ? (
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
