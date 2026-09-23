import { useUIStore } from '../store';
import { useTags } from '../hooks';
import { Tag as TagIcon, Loader2 } from 'lucide-react';

export function TagCloud() {
  const { activeFilter, activeTagName, setActiveTag } = useUIStore();

  const { data: tags, isLoading } = useTags();

  const handleTagClick = (tagName: string) => {
    setActiveTag(tagName);
  };

  return (
    <div className="mt-6">
      {/* Заголовок раздела тегов */}
      <div className="px-2 mb-2.5 flex items-center gap-2 text-slate-500 dark:text-slate-400">
        <TagIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <h5 className="text-xs font-semibold uppercase tracking-wider">
          Синапсы-Теги
        </h5>
      </div>

      {/* Состояние загрузки */}
      {isLoading ? (
        <div className="flex items-center gap-2 px-2 text-xs text-slate-400 animate-pulse">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Синхронизация тегов...</span>
        </div>
      ) : !tags || tags.length === 0 ? (
        /* Если у пользователя еще нет ни одного созданного тега */
        <p className="text-[11px] text-slate-400 italic px-2">
          Привяжите хэштег внутри заметки, чтобы активировать синапс.
        </p>
      ) : (
        /* Живое облако хэштегов из PostgreSQL */
        <div className="flex flex-wrap gap-1.5 px-1 pb-4">
          {tags.map((tag) => {
            const isActive =
              activeFilter === 'tag' && activeTagName === tag.name;
            return (
              <button
                key={tag.id}
                onClick={() => handleTagClick(tag.name)}
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full border transition-all duration-150 flex items-center gap-1 ${
                  isActive
                    ? 'bg-slate-900 border-slate-900 text-white dark:bg-slate-50 dark:border-slate-50 dark:text-slate-900 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900/50'
                }`}
              >
                <span>#{tag.name}</span>
                {/* Выводим счетчик заметок! */}
                <span
                  className={`text-[9px] font-mono ${isActive ? 'text-white/70 dark:text-slate-900/60' : 'text-slate-400'}`}
                >
                  ({tag.notes_count})
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
