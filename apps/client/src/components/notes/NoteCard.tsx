import { Checkbox } from '@/components/ui/checkbox';
import type { NotePreviewDTO } from '@synapse-kms/shared';
import { useAuthStore } from '@/store/useAuthStore';
import { Lock, User2, PenTool } from 'lucide-react';

interface NoteCardProps {
  note: NotePreviewDTO;
  isActive: boolean;
  isSelected: boolean;
  onSelectClick: () => void;
  onCardClick: () => void;
}

export function NoteCard({
  note,
  isActive,
  isSelected,
  onSelectClick,
  onCardClick,
}: NoteCardProps) {
  // Вытаскиваем username текущего пользователя для проверки владения
  const currentUsername = useAuthStore((state) => state.username);

  // Заменили на сравнение по username из DTO
  const isSharedNote = note.author && note.author.username !== currentUsername;

  // Проверяем состояние распределенной аренды замка из Redis
  const currentUserId = useAuthStore((state) => state.userId);
  const isLockedBySomeoneElse =
    note.lock?.isLocked && note.lock?.lockedBy !== currentUserId;

  // Красивое отображение имени автора
  const authorDisplayName = note.author
    ? note.author.displayName || note.author.username
    : 'Система';

  return (
    <div
      onClick={onCardClick}
      className={`group flex items-start gap-3 p-3 rounded-lg border text-left cursor-pointer transition-all duration-150 relative ${
        isActive
          ? 'bg-slate-50 border-slate-300 dark:bg-slate-900 dark:border-slate-700 shadow-sm'
          : 'bg-white border-slate-100 hover:bg-slate-50/50 dark:bg-slate-950 dark:border-slate-900'
      } ${isLockedBySomeoneElse ? 'opacity-85' : ''}`}
    >
      {/* Чекбокс массового выбора */}
      <div
        className="pt-0.5"
        onClick={(e) => {
          e.stopPropagation();
          onSelectClick();
        }}
      >
        <Checkbox checked={isSelected} className="h-4 w-4 cursor-pointer" />
      </div>

      {/* Контент карточки */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* МАРКЕР ШЕРИНГА: если заметка принадлежит коллеге */}
            {isSharedNote && (
              <User2 className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
            )}
            <span
              className={`font-semibold text-sm leading-none tracking-tight truncate ${
                isActive
                  ? 'text-slate-900 dark:text-slate-50'
                  : 'text-slate-800 dark:text-slate-200'
              }`}
            >
              {note.title || 'Без названия'}
            </span>
          </div>

          {/* МАРКЕР БЛОКИРОВКИ: статус замка из Redis */}
          {note.lock?.isLocked && (
            <span
              className={`text-[9px] font-mono font-medium px-1.5 py-0.5 rounded flex items-center gap-1 max-w-[120px] truncate select-none
                ${
                  isLockedBySomeoneElse
                    ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50 animate-pulse'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50'
                }`}
              title={
                isLockedBySomeoneElse
                  ? `Редактирует: ${note.lock.lockedByName}`
                  : 'Вы редактируете'
              }
            >
              <Lock className="h-2.5 w-2.5 shrink-0" />
              {/* Вместо безликого 'Занят' выводим имя того, кто залочил строку в Redis */}
              <span>
                {isLockedBySomeoneElse
                  ? note.lock.lockedByName || 'Занят'
                  : 'Ваш лок'}
              </span>
            </span>
          )}
        </div>

        {/* Текст превью */}
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed break-words">
          {note.preview ? note.preview : 'Пустая заметка...'}
        </p>

        {/* ПОДВАЛ КАРТОЧКИ: Теги + Автор */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {/* Теги */}
          <div className="flex flex-wrap gap-1 min-w-0">
            {note.tags &&
              note.tags.length > 0 &&
              note.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-slate-50 text-slate-500 border dark:bg-slate-900 dark:text-slate-400 truncate max-w-[80px]"
                >
                  #{tag}
                </span>
              ))}
          </div>

          {/* МАРКЕР АВТОРА: Тонкий бейдж, отображаемый для чужих (или всех) заметок */}
          {note.author && (
            <div
              className="flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-md border border-slate-200 bg-slate-50/50 text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400 shrink-0 max-w-[100px]"
              title={`Владелец заметки: ${note.author.username}`}
            >
              <PenTool className="h-2.5 w-2.5 opacity-70 shrink-0" />
              <span className="truncate">{authorDisplayName}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
