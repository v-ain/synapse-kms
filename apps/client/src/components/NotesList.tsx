import { useUIStore } from '../store';
import { useNotes, useFolders } from '../hooks';
import { SearchBar } from './SearchBar';
import { NoteCard } from './NoteCard';
import { CreateNoteForm } from './CreateNoteForm';
import { BulkActionsPanel } from './BulkActionsPanel';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { FileText, Loader2 } from 'lucide-react';

export function NotesList() {
  const {
    activeFilter,
    activeFolderId,
    activeNoteId,
    setActiveNote,
    selectedNoteIds,
    toggleSelectNote,
  } = useUIStore();

  const {
    data,
    isLoading: notesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotes();

  const notes = data?.pages.flatMap((page) => page.items) || [];
  const { data: folders } = useFolders();

  // Собираем ID всех текущих видимых на экране заметок для фичи "Выбрать все"
  const currentNotesIds = notes.map((n) => n.id);

  return (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-slate-950 p-4 relative overflow-hidden">
      {/* Шапка списка */}
      <div className="space-y-3 mb-3 shrink-0">
        <SearchBar />
        <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 px-1">
          {activeFilter === 'all' && '🌐 Все активные заметки'}
          {activeFilter === 'inbox' && '📥 Входящие документы'}
          {activeFilter === 'folder' &&
            `📁 Папка: ${folders?.find((f) => f.id === activeFolderId)?.title || '...'}`}
        </h4>
      </div>

      {/* ДЕКОМПОЗИРОВАННАЯ ПАНЕЛЬ МАССОВЫХ ДЕЙСТВИЙ */}
      {/* Теперь она встроена в поток, красиво сдвигает список вниз и не перекрывает первую карточку! */}
      <BulkActionsPanel currentNotesIds={currentNotesIds} />

      {/* Скролл-зона ленты заметок */}
      <div className="flex-1 overflow-y-auto min-h-0 -mx-2 px-2">
        <div className="space-y-2 pb-4">
          {notesLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs">Синхронизация базы знаний...</p>
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-600">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Тут пока пусто</p>
            </div>
          ) : (
            notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                isActive={activeNoteId === note.id}
                isSelected={selectedNoteIds.includes(note.id)}
                onSelectClick={() => toggleSelectNote(note.id)}
                onCardClick={() => setActiveNote(note.id)}
              />
            ))
          )}

          {hasNextPage && (
            <Button
              variant="secondary"
              className="w-full text-xs h-9 mt-2"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />{' '}
                  Загрузка...
                </>
              ) : (
                'Загрузить ещё'
              )}
            </Button>
          )}
        </div>
      </div>

      <Separator className="my-2 shrink-0" />

      {/* Форма создания заметки */}
      <CreateNoteForm />
    </div>
  );
}
