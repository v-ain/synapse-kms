import React, { useState } from 'react';
import { useCreateNote } from '../hooks';
import { useUIStore } from '../store';
import { CreateNoteSchema } from '@synapse-kms/shared';
import { mapZodErrorToUi } from '../utils/errorMapper';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Plus, AlertCircle } from 'lucide-react';

export function CreateNoteForm() {
  const { activeFilter, activeFolderId } = useUIStore();
  const createNoteMutation = useCreateNote();

  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');

  // Стейт для хранения ошибки валидации
  const [error, setError] = useState<string | null>(null);

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); // Сбрасываем ошибку перед новой валидацией

    const folderId = activeFilter === 'folder' ? activeFolderId : null;

    // Безопасный парсинг Zod-схемы на клиенте
    const validation = CreateNoteSchema.safeParse({
      title: newNoteTitle,
      content: newNoteContent,
      folderId: folderId,
    });

    if (!validation.success) {
      // Маппим ошибку в понятный русский текст и прерываем отправку
      setError(mapZodErrorToUi(validation.error));
      return;
    }

    // Если валидация успешна, шлём чистые проверенные данные
    createNoteMutation.mutate(validation.data, {
      onSuccess: () => {
        setNewNoteTitle('');
        setNewNoteContent('');
        setError(null);
      },
    });
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
        onChange={(e) => {
          setNewNoteTitle(e.target.value);
          if (error) setError(null); // Гасим ошибку, когда пользователь начинает исправлять ввод
        }}
        className={`h-9 bg-slate-50/50 dark:bg-slate-900/50 transition-colors ${
          error && (error.includes('Заголовок') || error.includes('пустым'))
            ? 'border-destructive focus-visible:ring-destructive dark:border-destructive'
            : ''
        }`}
        disabled={createNoteMutation.isPending}
      />

      {/* Текстовая область контента */}
      <Textarea
        placeholder="Контент заметки..."
        value={newNoteContent}
        onChange={(e) => {
          setNewNoteContent(e.target.value);
          if (error) setError(null);
        }}
        rows={2}
        className={`resize-none max-h-[280px] overflow-y-auto text-xs bg-slate-50/50 dark:bg-slate-900/50 leading-relaxed focus-visible:ring-1 transition-colors ${
          error && error.includes('Содержимое')
            ? 'border-destructive focus-visible:ring-destructive dark:border-destructive'
            : ''
        }`}
        disabled={createNoteMutation.isPending}
      />

      {/* Плавный вывод ошибки валидации под полями */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-destructive px-1 animate-in fade-in slide-in-from-top-1 duration-150">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Кнопка отправки */}
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
