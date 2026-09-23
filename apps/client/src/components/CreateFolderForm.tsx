import React, { useState } from 'react';
import { useCreateFolder } from '../hooks';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { FolderPlus } from 'lucide-react';

export function CreateFolderForm() {
  const createFolderMutation = useCreateFolder();
  const [newFolderTitle, setNewFolderTitle] = useState('');

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderTitle.trim()) return;
    createFolderMutation.mutate(
      { title: newFolderTitle },
      {
        onSuccess: () => setNewFolderTitle(''),
      }
    );
  };

  return (
    <form
      onSubmit={handleCreateFolder}
      className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2 shrink-0"
    >
      <Input
        type="text"
        placeholder="Новая папка..."
        value={newFolderTitle}
        onChange={(e) => setNewFolderTitle(e.target.value)}
        className="h-9 bg-white dark:bg-slate-950"
        disabled={createFolderMutation.isPending}
      />
      <Button
        type="submit"
        size="sm"
        disabled={createFolderMutation.isPending}
        className="w-full gap-1.5 h-9 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200"
      >
        <FolderPlus className="h-3.5 w-3.5" />
        {createFolderMutation.isPending ? 'Создание...' : 'Создать папку'}
      </Button>
    </form>
  );
}
