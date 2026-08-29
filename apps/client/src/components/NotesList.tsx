import React, { useState } from 'react';
import { useUIStore } from '../store';
import {
  useNotes,
  useFolders,
  useCreateNote,
  useBulkMoveNotes,
} from '../hooks';
import { SearchBar } from './SearchBar';

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
    <div className="notes-panel">
      <SearchBar />
      <h4>
        {activeFilter === 'all' && 'Все активные заметки'}
        {activeFilter === 'inbox' && 'Входящие документы'}
        {activeFilter === 'folder' &&
          `Папка: ${folders?.find((f) => f.id === activeFolderId)?.title}`}
      </h4>

      {selectedNoteIds.length > 0 && (
        <div className="bulk-panel">
          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
            Выбрано: {selectedNoteIds.length} шт.
          </span>
          <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
            <select
              value={targetFolderId}
              onChange={(e) => setTargetFolder(e.target.value)}
              style={{ flex: 1, padding: '2px' }}
            >
              <option value="inbox">📥 Входящие</option>
              {folders?.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.title}
                </option>
              ))}
            </select>
            <button
              onClick={handleBulkMove}
              style={{
                padding: '2px 10px',
                background: '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              ОК
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          marginBottom: '15px',
        }}
      >
        {notesLoading ? (
          <p>Синхронизация...</p>
        ) : notes?.length === 0 ? (
          <p style={{ color: '#888' }}>Тут пока пусто</p>
        ) : (
          notes?.map((note) => (
            <div
              key={note.id}
              onClick={() => setActiveNote(note.id)}
              className={`note-card ${activeNoteId === note.id ? 'active' : ''}`}
            >
              <input
                type="checkbox"
                checked={selectedNoteIds.includes(note.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelectNote(note.id);
                }}
                onChange={() => {}}
                style={{ marginTop: '4px', cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: 'bold',
                    marginBottom: '5px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{note.title}</span>
                  <span className="version-badge">v{note.version}</span>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#666',
                    marginBottom: '5px',
                  }}
                >
                  <div
                    className="text-gray-400 line-clamp-2 leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: note.preview || 'Нет содержимого...',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {note.tags?.map((tag) => (
                    <span key={tag} className="tag-badge">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="btn-submit"
            style={{
              background: '#e5e7eb',
              color: '#111',
              marginBottom: '10px',
            }}
          >
            {isFetchingNextPage
              ? '🚀 Синхронизация данных...'
              : '⬇️ Загрузить ещё задачи'}
          </button>
        )}
      </div>

      <form onSubmit={handleCreateNote} className="form-container">
        <h5>
          Новая заметка{' '}
          {activeFilter === 'folder' ? '(в текущую папку)' : '(во Входящие)'}
        </h5>
        <input
          type="text"
          placeholder="Заголовок..."
          value={newNoteTitle}
          onChange={(e) => setNewNoteTitle(e.target.value)}
          className="input-field"
        />
        <textarea
          placeholder="Контент заметки..."
          value={newNoteContent}
          onChange={(e) => setNewNoteContent(e.target.value)}
          rows={2}
          className="input-field"
          style={{ resize: 'none' }}
        />
        <button type="submit" className="btn-submit">
          + Добавить заметку
        </button>
      </form>
    </div>
  );
}
