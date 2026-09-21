import { useUIStore } from '../store';
import { useFolders, useNotes, useBulkMoveNotes } from '../hooks';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  CheckSquare,
  Folder,
  FolderInput,
  Inbox,
  Loader2,
  Square,
  X,
} from 'lucide-react';

interface BulkActionsPanelProps {
  currentNotesIds: string[];
}

export function BulkActionsPanel({ currentNotesIds }: BulkActionsPanelProps) {
  const {
    selectedNoteIds,
    targetFolderId,
    clearSelection,
    setTargetFolder,
    toggleSelectNote,
  } = useUIStore();

  const { data: notesData } = useNotes(); // Достаём кэш бесконечной ленты для сверки версий
  const { data: folders } = useFolders();
  const bulkMoveMutation = useBulkMoveNotes();

  const isAllSelected =
    currentNotesIds.length > 0 &&
    currentNotesIds.every((id) => selectedNoteIds.includes(id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      currentNotesIds.forEach((id) => {
        if (selectedNoteIds.includes(id)) toggleSelectNote(id);
      });
    } else {
      currentNotesIds.forEach((id) => {
        if (!selectedNoteIds.includes(id)) toggleSelectNote(id);
      });
    }
  };

  const handleBulkMove = () => {
    if (selectedNoteIds.length === 0) return;

    // 🧬 Достаём плоский массив всех заметок из кэша tRPC React Query
    const allNotesFlat = notesData?.pages.flatMap((page) => page.items) || [];

    // 🔒 ОПТИМИСТИЧНЫЙ ЗАМОК: маппим выделенные ID, сверяя их с актуальными версиями из кэша
    const itemsToSend = selectedNoteIds.map((id) => {
      const foundNote = allNotesFlat.find((n) => n.id === id);
      return {
        id,
        version: foundNote ? foundNote.version : 1, // отправляем точную версию из кэша
      };
    });

    const folderId = targetFolderId === 'inbox' ? null : targetFolderId;

    bulkMoveMutation.mutate(
      { items: itemsToSend, target_folder_id: folderId },
      {
        onSuccess: () => clearSelection(),
      }
    );
  };

  if (selectedNoteIds.length === 0) return null;

  return (
    <Card className="mb-3 border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/80 backdrop-blur-sm shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 shrink-0">
      <CardContent className="flex items-center justify-between p-2.5 gap-2">
        {/* Левая группа кнопок */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleSelectAll}
            className="h-8 px-2 text-xs gap-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {isAllSelected ? (
              <CheckSquare className="h-4 w-4 text-slate-900 dark:text-slate-50" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
              {isAllSelected ? 'Снять все' : 'Выбрать все'}
            </span>
          </Button>

          <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 shrink-0">
            {selectedNoteIds.length} шт.
          </span>
        </div>

        {/* Правая группа действий с красивыми иконками в селекте */}
        <div className="flex items-center gap-1.5 flex-1 max-w-[260px] justify-end">
          <Select
            value={targetFolderId}
            onValueChange={(value) => setTargetFolder(value)}
          >
            <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
              <SelectValue placeholder="Куда переместить?" />
            </SelectTrigger>
            <SelectContent>
              {/* Красивая иконка для Входящих */}
              <SelectItem value="inbox">
                <div className="flex items-center gap-2">
                  <Inbox className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>Входящие</span>
                </div>
              </SelectItem>

              {/* Динамический вывод папок со стильными иконками */}
              {folders?.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  <div className="flex items-center gap-2">
                    <Folder className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate max-w-[140px] text-left">
                      {f.title}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Кнопка применить */}
          <Button
            size="sm"
            className="h-8 text-xs px-2.5 shrink-0 gap-1"
            onClick={handleBulkMove}
            disabled={bulkMoveMutation.isPending}
          >
            {bulkMoveMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FolderInput className="h-3.5 w-3.5" />
            )}
            ОК
          </Button>

          {/* Кнопка очистки */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-slate-600 rounded-full shrink-0"
            onClick={clearSelection}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
