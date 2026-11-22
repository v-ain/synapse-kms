// Временный фасад в src/hooks.ts (удалишь после переноса компонентов)
import { useNotes as useNotesEntity } from '@/entities/note';
import { useNoteFiltersStore } from '@/features/note/filter';
import { useDeleteFolder as useDeleteFolderFeature } from '@/features/folder/delete';

export { useNote } from '@/entities/note';
export { useFolders } from '@/entities/folder';
export { useTags } from '@/entities/tag';

export { useCreateNote } from '@/features/note/create';
export { useUpdateNoteMeta, useNoteAutoSave } from '@/features/note/edit';
export { useArchiveNote } from '@/features/note/archive';
export { useBulkMoveNotes } from '@/features/note/bulk-actions';
export { useAttachTag } from '@/features/note/attach-tag';

export { useCreateFolder } from '@/features/folder/create';
export { useShareFolder } from '@/features/folder/share';

// Обертки для обратной совместимости
export function useNotes() {
  const { activeFilter, activeFolderId, activeTagName, searchQuery } =
    useNoteFiltersStore();

  return useNotesEntity({
    filter: activeFilter,
    folderId: activeFolderId,
    tagName: activeTagName,
    search: searchQuery,
  });
}

export function useDeleteFolder() {
  const setActiveFolder = useNoteFiltersStore((s) => s.setActiveFolder);
  return useDeleteFolderFeature({
    onDeleted: () => setActiveFolder(null),
  });
}
