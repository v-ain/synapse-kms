import React, { useState } from 'react';
import { useUIStore } from '../store';
import { useCreateNote } from '../hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';

export function CreateNoteForm() {
  const { activeFilter, activeFolderId } = useUIStore();
  const createNoteMutation = useCreateNote();

  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');

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
    <form onSubmit={handleCreateNote} className="space-y-2 shrink-0 pt-1">
      <h5 className="text-xs font-semibold text-slate-500 px-1">
        Новая заметка{' '}
        <span className="text-[10px] font-normal text-slate-400">
          {activeFilter === 'folder' ? '(в текущую папку)' : '(во Входящие)'}
        </span>
      </h5>

      {/* Инпут заголовка */}
      <Input
        type="text"
        placeholder="Заголовок..."
        value={newNoteTitle}
        onChange={(e) => setNewNoteTitle(e.target.value)}
        className="h-9 bg-slate-50/50 dark:bg-slate-900/50"
        disabled={createNoteMutation.isPending}
      />

      {/* 🔮 ФИКС БАГА: Жёстко зажимаем высоту черновика через max-h и разрешаем внутренний скролл */}
      <Textarea
        placeholder="Контент заметки..."
        value={newNoteContent}
        onChange={(e) => setNewNoteContent(e.target.value)}
        rows={2}
        className="resize-none max-h-[280px] overflow-y-auto text-xs bg-slate-50/50 dark:bg-slate-900/50 leading-relaxed focus-visible:ring-1"
        disabled={createNoteMutation.isPending}
      />

      {/* Кнопка отправки всегда остаётся на месте */}
      <Button
        type="submit"
        size="sm"
        disabled={createNoteMutation.isPending}
        className="w-full gap-1.5 h-9 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900"
      >
        <Plus className="h-4 w-4" />
        {createNoteMutation.isPending ? 'Создание...' : 'Добавить заметку'}
      </Button>
    </form>
  );
}
