import React, { useState } from 'react';
import { useUIStore } from '../store';
import { useNotes, useNote, useArchiveNote, useAttachTag } from '../hooks';
import { NoteEditor } from './NoteEditor';

export function NoteViewer() {
  const { activeNoteId } = useUIStore();
  const { data } = useNotes();
  const { data: fullNote, isLoading: contentLoading } = useNote(activeNoteId);
  const archiveNoteMutation = useArchiveNote();
  const attachTagMutation = useAttachTag();
  const [newTagName, setNewTagName] = useState('');

  // 🧬 Магия фикса: плоско разворачиваем все загруженные страницы кэша в один массив
  const allNotesFlat = data?.pages.flatMap((page) => page.items) || [];

  // Ищем нашу активную заметку в плоском массиве
  const activeNote = allNotesFlat.find((n) => n.id === activeNoteId);

  const handleAttachTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim() || !activeNoteId) return;
    attachTagMutation.mutate(
      { note_id: activeNoteId, tag_name: newTagName.trim() },
      {
        onSuccess: () => setNewTagName(''),
      }
    );
  };

  if (!activeNoteId) {
    return (
      <div
        className="viewer-panel"
        style={{ color: '#888', textAlign: 'center', marginTop: '150px' }}
      >
        <span
          style={{ fontSize: '40px', display: 'block', marginBottom: '10px' }}
        >
          🧠
        </span>
        <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
          Среда Synapse KMS готова к работе
        </div>
        <div style={{ fontSize: '13px', color: '#aaa' }}>
          Выберите любую заметку из центральной ленты для открытия графа знаний
        </div>
      </div>
    );
  }

  return (
    <div className="viewer-panel">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '5px',
        }}
      >
        <h2 style={{ margin: 0 }}>{activeNote?.title}</h2>
        <button
          onClick={() => {
            if (confirm('Удалить заметку в архив?'))
              archiveNoteMutation.mutate({ id: activeNoteId });
          }}
          style={{
            padding: '6px 12px',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          🗑️ В архив
        </button>
      </div>

      <p
        style={{
          color: '#888',
          fontSize: '12px',
          marginTop: 0,
          marginBottom: '20px',
        }}
      >
        Системная версия:{' '}
        <span style={{ fontWeight: 'bold', color: '#333' }}>
          {activeNote?.version}
        </span>
      </p>

      <form
        onSubmit={handleAttachTag}
        style={{ marginBottom: '20px', display: 'flex', gap: '5px' }}
      >
        <input
          type="text"
          placeholder="Новый хэштег..."
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          disabled={attachTagMutation.isPending}
          className="input-field"
          style={{ width: '200px' }}
        />
        <button
          type="submit"
          disabled={attachTagMutation.isPending}
          className="input-field"
          style={{ cursor: 'pointer', background: '#e5e7eb' }}
        >
          {attachTagMutation.isPending ? 'Привязка...' : '+ Добавить тег'}
        </button>
      </form>

      <hr
        style={{
          border: '0',
          borderTop: '1px solid #eee',
          marginBottom: '20px',
        }}
      />
      {contentLoading ? (
        <p style={{ color: '#aaa', fontStyle: 'italic' }}>
          Синхронизация синапса знаний с Podman...
        </p>
      ) : (
        <>
          <NoteEditor note={fullNote} />
          <div
            style={{
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap',
              background: '#fff',
              padding: '15px',
              borderRadius: '6px',
              border: '1px solid #f0f0f0',
            }}
          >
            {fullNote?.content || (
              <span style={{ color: '#aaa', fontStyle: 'italic' }}>
                Нет контента в этой заметке...
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
