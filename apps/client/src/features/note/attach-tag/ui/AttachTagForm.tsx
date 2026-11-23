import { useState } from 'react';
import { Loader2, Plus, Tag as TagIcon } from 'lucide-react';
import { useAttachTag } from '../api/useAttachTag';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

interface AttachTagFormProps {
  noteId: string;
}

export function AttachTagForm({ noteId }: AttachTagFormProps) {
  const attachTagMutation = useAttachTag();
  const [newTagName, setNewTagName] = useState('');

  const handleAttachTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    attachTagMutation.mutate(
      { noteId, tagName: newTagName.trim() },
      { onSuccess: () => setNewTagName('') }
    );
  };

  return (
    <form
      onSubmit={handleAttachTag}
      className="flex items-center gap-2 mb-4 shrink-0"
    >
      <div className="relative w-full max-w-[200px]">
        <TagIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
        <Input
          type="text"
          placeholder="Новый хэштег..."
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          disabled={attachTagMutation.isPending}
          className="pl-8 h-8 text-xs bg-slate-50/50 dark:bg-slate-900/50"
        />
      </div>
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        className="h-8 text-xs gap-1"
        disabled={attachTagMutation.isPending}
      >
        {attachTagMutation.isPending ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" /> Привязка...
          </>
        ) : (
          <>
            <Plus className="h-3.5 w-3.5" /> Добавить тег
          </>
        )}
      </Button>
    </form>
  );
}
