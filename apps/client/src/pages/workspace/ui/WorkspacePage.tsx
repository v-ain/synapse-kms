import { Sidebar } from '@/widgets/sidebar';
import { NotesList } from '@/widgets/notes-list';
import { NoteViewer } from '@/widgets/note-workspace';
import { Header } from '@/widgets/header';
import { useActiveNoteStore } from '@/entities/note';
import { useWorkspaceSync } from '../model/useWorkspaceSync';

export function WorkspacePage() {
  useWorkspaceSync();
  const activeNoteId = useActiveNoteStore((state) => state.activeNoteId);

  return (
    <div className="flex flex-col h-screen w-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50 overflow-hidden transition-colors duration-200">
      <Header mobileMenuSlot={<Sidebar />} />

      <div className="flex flex-1 w-full h-full min-h-0 overflow-hidden relative">
        <div className="hidden lg:block w-64 h-full shrink-0">
          <Sidebar />
        </div>

        <div
          className={`
            w-full md:w-[400px] h-full border-r border-slate-200 dark:border-slate-800 shrink-0 flex flex-col min-h-0
            ${activeNoteId ? 'hidden md:block' : 'block'}
          `}
        >
          <NotesList />
        </div>

        <div
          className={`
            flex-1 h-full min-w-0 flex flex-col min-h-0
            ${!activeNoteId ? 'hidden md:block' : 'block'}
          `}
        >
          <NoteViewer />
        </div>
      </div>
    </div>
  );
}
