import { useUIStore } from '@/store';
import { Brain } from 'lucide-react';
import { NoteWorkspace } from './NoteWorkspace';

export function NoteViewer() {
  const { activeNoteId } = useUIStore();

  if (!activeNoteId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-slate-50/30 dark:bg-slate-900/10">
        <div className="rounded-full bg-slate-100 p-4 mb-4 dark:bg-slate-900 animate-pulse">
          <Brain className="h-10 w-10 text-slate-400 dark:text-slate-600" />
        </div>
        <h4 className="text-base font-semibold tracking-tight text-slate-800 dark:text-slate-200">
          Среда Synapse KMS готова к работе
        </h4>
        <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mt-1.5 leading-relaxed">
          Выберите любую заметку из центральной ленты для открытия графа знаний
          и управления синапсами.
        </p>
      </div>
    );
  }

  return <NoteWorkspace noteId={activeNoteId} />;
}
