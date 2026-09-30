import { useState, useEffect, useRef } from 'react';
import { useUpdateNote } from '@/hooks';
import { Textarea } from '@/components/ui/textarea';
import { CloudCheck, Loader2, AlertCircle, PencilLine } from 'lucide-react';
import type { Note } from '@synapse-kms/shared';

interface EditorProps {
  note: Note;
}

type SyncStatus = 'saved' | 'dirty' | 'saving' | 'error';

export const NoteEditor = ({ note }: EditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSentTextRef = useRef(note.content || '');

  // Страховочный реф для хранения актуального текста в памяти (спасает unmount в happy-dom/тестах)
  const currentTextRef = useRef(note.content || '');

  const debounceSaveRef = useRef<(text: string) => void>(() => {});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Храним локальные статусы, которыми управляем вручную
  const [localStatus, setLocalStatus] = useState<'saved' | 'dirty' | 'error'>(
    'saved'
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Мгновенный счетчик слов для UI метаданных
  const [wordCount, setWordCount] = useState(
    () => (note.content || '').split(/\s+/).filter(Boolean).length
  );

  const { updateNote, isPending } = useUpdateNote();

  // Если идет сетевой запрос, принудительно выставляем 'saving', иначе берем локальный стейт
  const status: SyncStatus = isPending ? 'saving' : localStatus;

  // Сетевая функция отправки
  const executeNetworkSave = (currentText: string) => {
    if (currentText.length > 5000 || currentText === lastSentTextRef.current) {
      return;
    }

    lastSentTextRef.current = currentText;

    // Отправляем импульс в сеть и передаем колбэки для управления локальным статусом
    updateNote(
      {
        id: note.id,
        content: currentText,
      },
      {
        onSuccess: () => {
          setLocalStatus('saved');
          setErrorMsg(null);
        },
        onError: (err: any) => {
          setLocalStatus('error');
          setErrorMsg(
            err?.message || 'Сеть недоступна. Буфер сохранен локально.'
          );
        },
      }
    );
  };

  // Инициализируем функцию дебаунса один раз при монтировании (Key гарантирует сброс при смене заметки)
  useEffect(() => {
    debounceSaveRef.current = (text: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        executeNetworkSave(text);
      }, 1000);
    };

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [note.id]);

  // Гарантия фиксации данных при размонтировании (берет данные строго из стабильной памяти рефа)
  useEffect(() => {
    return () => {
      const finalText = currentTextRef.current;
      if (finalText.length <= 5000 && finalText !== lastSentTextRef.current) {
        executeNetworkSave(finalText);
      }
    };
  }, [note.id]);

  // onChange-координатор
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;

    // Синхронизируем строковый реф для unmount-эффекта и blur
    currentTextRef.current = val;

    // Мгновенно пересчитываем слова для интерфейса
    setWordCount(val.split(/\s+/).filter(Boolean).length);

    // Вынесенная валидация лимита (блокирует сеть на лету)
    if (val.length > 5000) {
      setErrorMsg('Превышен лимит в 5000 символов');
      setLocalStatus('error');
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    if (errorMsg) setErrorMsg(null);

    // Включаем статус изменения и вызываем дебаунс
    setLocalStatus('dirty');
    debounceSaveRef.current(val);
  };

  // Обработчик потери фокуса (сохраняем немедленно, минуя секундное ожидание)
  const handleBlur = () => {
    const val = currentTextRef.current;

    if (val.length <= 5000 && val !== lastSentTextRef.current) {
      if (timerRef.current) clearTimeout(timerRef.current);
      executeNetworkSave(val);
    }
  };

  const lastSavedTime = note.clientUpdatedAt
    ? new Date(note.clientUpdatedAt).toLocaleTimeString()
    : '--:--:--';

  return (
    <div className="flex flex-col w-full space-y-2">
      {/* НЕКОНТРОЛИРУЕМЫЙ DOM-ИНПУТ С УЛЬТРА-СКОРОСТЬЮ ВВОДА */}
      <Textarea
        ref={textareaRef}
        defaultValue={note.content || ''}
        onChange={handleInputChange}
        onBlur={handleBlur}
        placeholder="Начните писать ваши мысли здесь..."
        className={`w-full min-h-[300px] p-4 bg-slate-50/30 dark:bg-slate-900/30 border-slate-100 dark:border-slate-900 focus-visible:ring-1 font-mono text-sm leading-relaxed resize-y transition-colors ${
          status === 'error'
            ? 'border-destructive focus-visible:ring-destructive dark:border-destructive'
            : 'focus-visible:ring-slate-300 dark:focus-visible:ring-slate-800'
        }`}
      />

      {/* СТАТУС-БАР С ЧЕТКОЙ СТЕЙТ-МАШИНОЙ */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-slate-50 border border-slate-100 text-[11px] font-medium text-slate-500 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 select-none">
        <div className="flex items-center gap-1.5">
          {status === 'error' && (
            <div className="flex items-center gap-1 text-destructive font-semibold animate-in fade-in duration-150">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {status === 'dirty' && (
            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-500 animate-in fade-in duration-150">
              <PencilLine className="h-3.5 w-3.5 shrink-0" />
              <span>Есть несохраненные изменения</span>
            </div>
          )}

          {status === 'saving' && (
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span>Синхронизация синапса...</span>
            </div>
          )}

          {status === 'saved' && (
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500 animate-in fade-in duration-150">
              <CloudCheck className="h-3 w-3" />
              <span>Сохранено в KMS</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 font-mono">
          <span>
            Слов:{' '}
            <strong className="text-slate-700 dark:text-slate-300">
              {wordCount}
            </strong>
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span>
            Синхронизировано:{' '}
            <strong className="text-slate-700 dark:text-slate-300">
              {lastSavedTime}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
};
