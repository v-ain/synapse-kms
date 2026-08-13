import React, { useState } from 'react';
import { useUIStore } from '../store';
import { useFolders, useCreateFolder, useDeleteFolder } from '../hooks';

export function Sidebar() {
  const { activeFilter, activeFolderId, setActiveFolder, setFilter } =
    useUIStore();
  const { data: folders, isLoading } = useFolders();
  const createFolderMutation = useCreateFolder();
  const deleteFolderMutation = useDeleteFolder();
  const [newFolderTitle, setNewFolderTitle] = useState('');

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderTitle.trim()) return;
    createFolderMutation.mutate(newFolderTitle, {
      onSuccess: () => setNewFolderTitle(''),
    });
  };

  return (
    <div className="sidebar-panel">
      <h3>Synapse KMS</h3>

      <div style={{ marginBottom: '20px' }}>
        <button
          className={`nav-btn ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          🌐 Все заметки
        </button>
        <button
          className={`nav-btn ${activeFilter === 'inbox' ? 'active' : ''}`}
          onClick={() => setFilter('inbox')}
        >
          📥 Входящие
        </button>
      </div>

      <h5>Папки</h5>
      {isLoading ? (
        <p>Загрузка...</p>
      ) : (
        <ul className="list-unstyled">
          {folders?.map((folder) => (
            <li
              key={folder.id}
              style={{ marginBottom: '8px', display: 'flex', gap: '5px' }}
            >
              <button
                className={`nav-btn ${activeFolderId === folder.id ? 'active' : ''}`}
                onClick={() => setActiveFolder(folder.id)}
              >
                📁 {folder.title}{' '}
                <span style={{ color: '#888' }}>({folder.notes_count})</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Удалить папку?'))
                    deleteFolderMutation.mutate(folder.id);
                }}
                style={{
                  color: 'red',
                  border: '1px solid red',
                  background: 'none',
                  cursor: 'pointer',
                  borderRadius: '3px',
                  padding: '0 6px',
                }}
              >
                X
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={handleCreateFolder}
        className="form-container"
        style={{ marginTop: '10px' }}
      >
        <input
          type="text"
          placeholder="Новая папка..."
          value={newFolderTitle}
          onChange={(e) => setNewFolderTitle(e.target.value)}
          className="input-field"
        />
        <button type="submit" className="btn-submit">
          + Создать папку
        </button>
      </form>
    </div>
  );
}
