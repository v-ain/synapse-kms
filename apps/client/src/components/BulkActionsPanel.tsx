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

  const { data: notesData } = useNotes();
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

    const allNotesFlat = notesData?.pages.flatMap((page) => page.items) || [];
    const itemsToSend = selectedNoteIds.map((id) => {
      const foundNote = allNotesFlat.find((n) => n.id === id);
      return {
        id,
        version: foundNote ? foundNote.version : 1,
      };
    });

    const folderId = targetFolderId === 'inbox' ? null : targetFolderId;

    bulkMoveMutation.mutate(
      { items: itemsToSend, target_folder_id: folderId },
      { onSuccess: () => clearSelection() }
    );
  };

  if (selectedNoteIds.length === 0) return null;

  return (
    <Card className="mb-3 border-slate-200 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-900/90 backdrop-blur-sm shadow-md animate-in fade-in slide-in-from-top-2 duration-200 shrink-0">
      <CardContent className="p-3 space-y-2.5">
        {/* 1️⃣ ПЕРВАЯ СТРОКА: Увеличили чекбокс, дали полную свободу селекту и кнопке ОК */}
        <div className="flex items-center gap-3 w-full">
          {/* Инпут выделения всех заметок: Крупный тач-таргет с иконкой побольше */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleSelectAll}
            // h-9 вместо h-8 — кнопка стала выше, по ней намного легче попасть пальцем
            className="h-9 px-2.5 text-xs gap-2 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 shrink-0 rounded-md bg-white/50 dark:bg-slate-950/30 border border-slate-200/50 dark:border-slate-800/50"
          >
            {isAllSelected ? (
              <CheckSquare className="h-4.5 w-4.5 text-slate-900 dark:text-slate-50" />
            ) : (
              <Square className="h-4.5 w-4.5 text-slate-400" />
            )}
            <span className="font-semibold">
              {isAllSelected ? 'Снять' : 'Все'}
            </span>
          </Button>

          {/* Селект папок: Занимает ВСЁ оставшееся пространство (flex-1) */}
          <div className="flex-1 min-w-0">
            <Select
              value={targetFolderId}
              onValueChange={(value) => setTargetFolder(value)}
            >
              <SelectTrigger className="h-9 text-xs bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 w-full shadow-sm">
                <SelectValue placeholder="Куда переместить?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inbox">
                  <div className="flex items-center gap-2">
                    <Inbox className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>Входящие</span>
                  </div>
                </SelectItem>
                {folders?.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    <div className="flex items-center gap-2">
                      <Folder className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[180px] text-left">
                        {f.title}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Кнопка ОК: Стабильная ширина, h-9 */}
          <Button
            size="sm"
            className="h-9 text-xs px-3.5 shrink-0 gap-1.5 font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900 shadow-sm"
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
        </div>

        {/* 2️⃣ ВТОРАЯ СТРОКА: Информационная панель (Счетчик и кнопка отмены) */}
        <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800/60 pt-2 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span>Выбрано элементов для переноса:</span>
            <span className="font-mono font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
              {selectedNoteIds.length}
            </span>
          </div>

          {/* Кнопка быстрой отмены всего выделения */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 gap-1 rounded text-[11px]"
            onClick={clearSelection}
          >
            <X className="h-3 w-3" />
            <span>Сбросить</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
