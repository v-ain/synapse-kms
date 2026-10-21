import { useState, useEffect, useRef } from 'react';
import { useUpdateNote } from '@/hooks'; // 🔒 Импортируем наш хук блокировок
import { Textarea } from '@/components/ui/textarea';
import {
  CloudCheck,
  Loader2,
  AlertCircle,
  PencilLine,
  Lock,
} from 'lucide-react';
import type { NoteDTO } from '@synapse-kms/shared'; // Используем наш обновленный DTO
import { useNoteLock } from '@/hooks/useNoteLock';
import { useNoteLockStore } from '@/store/useNoteLockStore';

interface EditorProps {
  note: NoteDTO;
}

type SyncStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'locked';

export const NoteEditor_v2 = ({ note }: EditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSentTextRef = useRef(note.content || '');
  const currentTextRef = useRef(note.content || '');

  const debounceSaveRef = useRef<(text: string) => void>(() => {});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 🔒 Подключаем распределенную систему аренды замка
  const { isReadOnly, lockedByUserName } = useNoteLock(note.id);

  const [localStatus, setLocalStatus] = useState<'saved' | 'dirty' | 'error'>(
    'saved'
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [wordCount, setWordCount] = useState(
    () => (note.content || '').split(/\s+/).filter(Boolean).length
  );

  const { updateNote, isPending } = useUpdateNote();

  // Вычисляем статус: если заблокировано кем-то — принудительно 'locked'
  const status: SyncStatus = isReadOnly
    ? 'locked'
    : isPending
      ? 'saving'
      : localStatus;

  // Сетевая функция отправки
  const executeNetworkSave = (currentText: string) => {
    // 🛡️ Защита: если мы в Read-Only, блокируем любые сетевые мутации
    if (
      isReadOnly ||
      currentText.length > 5000 ||
      currentText === lastSentTextRef.current
    ) {
      return;
    }

    lastSentTextRef.current = currentText;

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

  // Инициализируем дебаунс
  useEffect(() => {
    debounceSaveRef.current = (text: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (isReadOnly) return; // Защита

      timerRef.current = setTimeout(() => {
        executeNetworkSave(text);
      }, 1000);
    };

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [note.id, isReadOnly]);

  // Фиксация данных при размонтировании
  useEffect(() => {
    return () => {
      if (isReadOnly) return; // Защита: не сохраняем чужой прогресс

      const { isReadOnly: latestIsReadOnly } = useNoteLockStore.getState();
      const finalText = currentTextRef.current;

      if (
        !latestIsReadOnly &&
        finalText.length <= 5000 &&
        finalText !== lastSentTextRef.current
      ) {
        executeNetworkSave(finalText);
      }
    };
  }, [note.id, isReadOnly]);

  // onChange-координатор
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isReadOnly) return; // Защита на случай обхода disabled в DOM

    const val = e.target.value;
    currentTextRef.current = val;
    setWordCount(val.split(/\s+/).filter(Boolean).length);

    if (val.length > 5000) {
      setErrorMsg('Превышен лимит в 5000 символов');
      setLocalStatus('error');
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    if (errorMsg) setErrorMsg(null);
    setLocalStatus('dirty');
    debounceSaveRef.current(val);
  };

  // Обработчик потери фокуса
  const handleBlur = () => {
    if (isReadOnly) return; // Защита
    const val = currentTextRef.current;

    if (val.length <= 5000 && val !== lastSentTextRef.current) {
      if (timerRef.current) clearTimeout(timerRef.current);
      executeNetworkSave(val);
    }
  };

  // Используем системный updatedAt вместо удаленного clientUpdatedAt
  const lastSavedTime = note.updatedAt
    ? new Date(note.updatedAt).toLocaleTimeString()
    : '--:--:--';

  return (
    <div className="flex flex-col w-full space-y-2 animate-in fade-in duration-200">
      {/* 🔒 ИНФОРМАЦИОННЫЙ БАННЕР БЛОКИРОВКИ */}
      {status === 'locked' && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-amber-200/60 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/40 text-amber-800 dark:text-amber-400 text-xs font-medium animate-in slide-in-from-top-2 duration-200">
          <Lock className="h-3.5 w-3.5 shrink-0 animate-pulse text-amber-500" />
          <span>
            Режим чтения. Коллега{' '}
            <strong className="font-semibold underline">
              {lockedByUserName}
            </strong>{' '}
            прямо сейчас редактирует эту заметку.
          </span>
        </div>
      )}

      {/* ТЕКСТОВОЕ ПОЛЕ */}
      <Textarea
        ref={textareaRef}
        defaultValue={note.content || ''}
        onChange={handleInputChange}
        onBlur={handleBlur}
        disabled={isReadOnly} // 🔒 Замок на уровне браузера
        placeholder={
          isReadOnly
            ? 'Заметка редактируется другим пользователем...'
            : 'Начните писать ваши мысли здесь...'
        }
        className={`w-full min-h-[300px] p-4 bg-slate-50/30 dark:bg-slate-900/30 border-slate-100 dark:border-slate-900 focus-visible:ring-1 font-mono text-sm leading-relaxed resize-y transition-all ${
          status === 'error'
            ? 'border-destructive focus-visible:ring-destructive'
            : status === 'locked'
              ? 'opacity-60 bg-slate-100/50 dark:bg-slate-900/50 border-dashed select-none cursor-not-allowed focus-visible:ring-transparent'
              : 'focus-visible:ring-slate-300 dark:focus-visible:ring-slate-800'
        }`}
      />

      {/* СТАТУС-БАР */}
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

          {status === 'locked' && (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500 font-semibold">
              <Lock className="h-3 w-3 text-amber-500" />
              <span>Заблокировано (Read-Only)</span>
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
