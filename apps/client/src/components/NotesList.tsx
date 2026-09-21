import React, { useState } from 'react';
import { useUIStore } from '../store';
import {
  useNotes,
  useFolders,
  useCreateNote,
  useBulkMoveNotes,
} from '../hooks';
import { SearchBar } from './SearchBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { FileText, FolderInput, Loader2, Plus } from 'lucide-react';

export function NotesList() {
  const {
    activeFilter,
    activeFolderId,
    activeNoteId,
    setActiveNote,
    selectedNoteIds,
    targetFolderId,
    toggleSelectNote,
    clearSelection,
    setTargetFolder,
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
  const createNoteMutation = useCreateNote();
  const bulkMoveMutation = useBulkMoveNotes();

  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');

  const handleBulkMove = () => {
    if (selectedNoteIds.length === 0) return;
    const itemsToSend =
      notes
        ?.filter((n) => selectedNoteIds.includes(n.id))
        .map((n) => ({ id: n.id, version: n.version })) || [];
    const folderId = targetFolderId === 'inbox' ? null : targetFolderId;
    bulkMoveMutation.mutate(
      { items: itemsToSend, target_folder_id: folderId },
      { onSuccess: () => clearSelection() }
    );
  };

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim()) return;
    const folderId = activeFilter === 'folder' ? activeFolderId : null;
    createNoteMutation.mutate(
      { title: newNoteTitle, content: newNoteContent, folder_id: folderId },
      {
        onSuccess: () => {
          setNewNoteTitle('');
          setNewNoteContent('');
        },
      }
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-slate-950 p-4 relative overflow-hidden">
      {/* Шапка списка */}
      <div className="space-y-3 mb-4 shrink-0">
        <SearchBar />
        <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 px-1">
          {activeFilter === 'all' && '🌐 Все активные заметки'}
          {activeFilter === 'inbox' && '📥 Входящие документы'}
          {activeFilter === 'folder' &&
            `📁 Папка: ${folders?.find((f) => f.id === activeFolderId)?.title || '...'}`}
        </h4>
      </div>

      {/* Панель массовых действий */}
      {selectedNoteIds.length > 0 && (
        <Card className="absolute top-16 left-4 right-4 z-20 shadow-lg border-primary/20 bg-slate-50/95 backdrop-blur-sm dark:bg-slate-900/95">
          <CardContent className="flex items-center justify-between p-3 gap-3">
            <span className="text-xs font-bold shrink-0">
              Выбрано: {selectedNoteIds.length} шт.
            </span>
            <div className="flex items-center gap-2 flex-1 max-w-[240px]">
              <Select
                value={targetFolderId}
                onValueChange={(value) => setTargetFolder(value)}
              >
                <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-950">
                  <SelectValue placeholder="Куда?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbox">📥 Входящие</SelectItem>
                  {folders?.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      📁 {f.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-8 text-xs px-3"
                onClick={handleBulkMove}
              >
                <FolderInput className="h-3.5 w-3.5 mr-1" /> ОК
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Скролл-зона ленты заметок */}
      <div className="flex-1 overflow-y-auto -mx-2 px-2 min-h-0">
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
            notes.map((note) => {
              const isSelected = selectedNoteIds.includes(note.id);
              const isActive = activeNoteId === note.id;
              return (
                <div
                  key={note.id}
                  onClick={() => setActiveNote(note.id)}
                  className={`group flex items-start gap-3 p-3 rounded-lg border text-left cursor-pointer transition-all duration-150 ${
                    isActive
                      ? 'bg-slate-50 border-slate-300 dark:bg-slate-900 dark:border-slate-700 shadow-sm'
                      : 'bg-white border-slate-100 hover:bg-slate-50/50 dark:bg-slate-950 dark:border-slate-900'
                  }`}
                >
                  <div
                    className="pt-0.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectNote(note.id);
                    }}
                  >
                    <Checkbox
                      checked={isSelected}
                      className="h-4 w-4 cursor-pointer"
                    />
                  </div>
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
            })
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
      <form onSubmit={handleCreateNote} className="space-y-2 shrink-0 pt-1">
        <h5 className="text-xs font-semibold text-slate-500 px-1">
          Новая заметка{' '}
          <span className="text-[10px] font-normal text-slate-400">
            {activeFilter === 'folder' ? '(в папку)' : '(во Входящие)'}
          </span>
        </h5>
        <Input
          type="text"
          placeholder="Заголовок..."
          value={newNoteTitle}
          onChange={(e) => setNewNoteTitle(e.target.value)}
          className="h-9 bg-slate-50/50 dark:bg-slate-900/50"
        />
        <Textarea
          placeholder="Контент..."
          value={newNoteContent}
          onChange={(e) => setNewNoteContent(e.target.value)}
          rows={2}
          className="resize-none min-h-[50px] text-xs bg-slate-50/50 dark:bg-slate-900/50"
        />
        <Button
          type="submit"
          size="sm"
          className="w-full gap-1.5 h-9 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900"
        >
          <Plus className="h-4 w-4" /> Добавить заметку
        </Button>
      </form>
    </div>
  );
}
