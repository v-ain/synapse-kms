import { Checkbox } from '@/components/ui/checkbox';

interface NoteCardProps {
  note: {
    id: string;
    title: string;
    version: number;
    preview: string | null;
    tags: string[] | null;
  };
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
  return (
    <div
      onClick={onCardClick}
      className={`group flex items-start gap-3 p-3 rounded-lg border text-left cursor-pointer transition-all duration-150 ${
        isActive
          ? 'bg-slate-50 border-slate-300 dark:bg-slate-900 dark:border-slate-700 shadow-sm'
          : 'bg-white border-slate-100 hover:bg-slate-50/50 dark:bg-slate-950 dark:border-slate-900'
      }`}
    >
      {/* Чекбокс массового выбора */}
      <div
        className="pt-0.5"
        onClick={(e) => {
          e.stopPropagation(); // Защита от открытия заметки при клике на чекбокс
          onSelectClick();
        }}
      >
        <Checkbox checked={isSelected} className="h-4 w-4 cursor-pointer" />
      </div>

      {/* Контент карточки */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold text-sm leading-none tracking-tight truncate text-slate-900 dark:text-slate-50">
            {note.title || 'Без названия'}
          </span>
          <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 dark:bg-slate-800">
            v{note.version}
          </span>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
          {note.preview ? note.preview : 'Пустая заметка...'}
        </p>

        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {note.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-slate-50 text-slate-500 border dark:bg-slate-900 dark:text-slate-400"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
