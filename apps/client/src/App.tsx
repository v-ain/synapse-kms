import React, { useState } from 'react';
import { useUIStore } from './store';
import {
  useFolders,
  useNotes,
  useNoteContent,
  useCreateFolder,
  useCreateNote,
  useBulkMoveNotes,
  useDeleteFolder,
  useArchiveNote,
  useAttachTag,
} from './hooks';

export default function App() {
  const {
    activeFilter,
    activeFolderId,
    activeNoteId,
    setActiveFolder,
    setFilter,
    setActiveNote,
  } = useUIStore();

  // Данные
  const { data: folders, isLoading: foldersLoading } = useFolders();
  const { data: notes, isLoading: notesLoading } = useNotes();
  const { data: fullNote, isLoading: contentLoading } =
    useNoteContent(activeNoteId);

  // Мутации
  const createFolderMutation = useCreateFolder();
  const createNoteMutation = useCreateNote();
  const bulkMoveMutation = useBulkMoveNotes();
  const deleteFolderMutation = useDeleteFolder();
  const archiveNoteMutation = useArchiveNote();
  const attachTagMutation = useAttachTag();

  // Локальные стейты форм
  const [newFolderTitle, setNewFolderTitle] = useState('');
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newTagName, setNewTagName] = useState(''); // Стейт для поля тегов

  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [targetFolderId, setTargetFolderId] = useState<string>('inbox');

  const handleToggleSelect = (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNoteIds((prev) =>
      prev.includes(noteId)
        ? prev.filter((id) => id !== noteId)
        : [...prev, noteId]
    );
  };

  const handleBulkMove = () => {
    if (selectedNoteIds.length === 0) return;
    const itemsToSend =
      notes
        ?.filter((n) => selectedNoteIds.includes(n.id))
        .map((n) => ({ id: n.id, version: n.version })) || [];
    const folderId = targetFolderId === 'inbox' ? null : targetFolderId;
    bulkMoveMutation.mutate(
      { items: itemsToSend, target_folder_id: folderId },
      { onSuccess: () => setSelectedNoteIds([]) }
    );
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderTitle.trim()) return;
    createFolderMutation.mutate(newFolderTitle, {
      onSuccess: () => setNewFolderTitle(''),
    });
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

  // 🎯 Хэндлер привязки тега
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

  // 🎯 Хэндлер удаления папки
  const handleDeleteFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Чтобы при клике на крестик не происходил переход в папку
    if (
      confirm(
        'Удалить эту папку? Все заметки внутри неё переместятся во Входящие.'
      )
    ) {
      deleteFolderMutation.mutate(folderId);
    }
  };

  const activeNote = notes?.find((n) => n.id === activeNoteId);

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      {/* 📁 1. БОКОВАЯ ПАНЕЛЬ */}
      <div
        style={{
          width: '260px',
          borderRight: '1px solid #ccc',
          padding: '15px',
          background: '#f9f9f9',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h3>Synapse KMS</h3>

        <div style={{ marginBottom: '20px' }}>
          <button
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              marginBottom: '5px',
              fontWeight: activeFilter === 'all' ? 'bold' : 'normal',
            }}
            onClick={() => setFilter('all')}
          >
            🌐 Все заметки
          </button>
          <button
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              fontWeight: activeFilter === 'inbox' ? 'bold' : 'normal',
            }}
            onClick={() => setFilter('inbox')}
          >
            📥 Входящие
          </button>
        </div>

        <h5>Папки</h5>
        {foldersLoading ? (
          <p>Загрузка...</p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              flex: 1,
              overflowY: 'auto',
            }}
          >
            {folders?.map((folder) => (
              <li
                key={folder.id}
                style={{ marginBottom: '8px', display: 'flex', gap: '5px' }}
              >
                <button
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    fontWeight:
                      activeFolderId === folder.id ? 'bold' : 'normal',
                  }}
                  onClick={() => setActiveFolder(folder.id)}
                >
                  📁 {folder.title}{' '}
                  <span style={{ color: '#888' }}>({folder.notes_count})</span>
                </button>
                {/* 🎯 КНОПКА УДАЛЕНИЯ ПАПКИ */}
                <button
                  onClick={(e) => handleDeleteFolder(folder.id, e)}
                  style={{
                    color: 'red',
                    border: '1px solid red',
                    background: 'none',
                    cursor: 'pointer',
                    borderRadius: '3px',
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
          style={{
            borderTop: '1px solid #ddd',
            paddingTop: '10px',
            marginTop: '10px',
          }}
        >
          <input
            type="text"
            placeholder="Новая папка..."
            value={newFolderTitle}
            onChange={(e) => setNewFolderTitle(e.target.value)}
            style={{ width: '90%', padding: '5px', marginBottom: '5px' }}
          />
          <button type="submit" style={{ width: '97%', padding: '5px' }}>
            + Создать папку
          </button>
        </form>
      </div>

      {/* 📝 2. ЦЕНТРАЛЬНАЯ ЛЕНТА */}
      <div
        style={{
          width: '360px',
          borderRight: '1px solid #ccc',
          padding: '15px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h4>
          {activeFilter === 'all' && 'Все активные заметки'}
          {activeFilter === 'inbox' && 'Входящие документы'}
          {activeFilter === 'folder' &&
            `Папка: ${folders?.find((f) => f.id === activeFolderId)?.title}`}
        </h4>

        {selectedNoteIds.length > 0 && (
          <div
            style={{
              background: '#eef9ff',
              padding: '10px',
              borderRadius: '4px',
              marginBottom: '10px',
              border: '1px solid #bce1f5',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
              Выбрано: {selectedNoteIds.length} шт.
            </span>
            <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
              <select
                value={targetFolderId}
                onChange={(e) => setTargetFolderId(e.target.value)}
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
                style={{
                  padding: '10px',
                  border:
                    activeNoteId === note.id
                      ? '2px solid black'
                      : '1px solid #eee',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: activeNoteId === note.id ? '#fff' : '#fafafa',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedNoteIds.includes(note.id)}
                  onClick={(e) => handleToggleSelect(note.id, e)}
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
                    <span style={{ fontSize: '10px', color: '#aaa' }}>
                      v{note.version}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#666',
                      marginBottom: '5px',
                    }}
                  >
                    {note.preview}...
                  </div>
                  <div
                    style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}
                  >
                    {note.tags?.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: '10px',
                          background: '#e0e0e0',
                          padding: '2px 6px',
                          borderRadius: '10px',
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={handleCreateNote}
          style={{
            borderTop: '1px solid #ddd',
            paddingTop: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
          }}
        >
          <h5>
            Новая заметка{' '}
            {activeFilter === 'folder' ? '(в текущую папку)' : '(во Входящие)'}
          </h5>
          <input
            type="text"
            placeholder="Заголовок..."
            value={newNoteTitle}
            onChange={(e) => setNewNoteTitle(e.target.value)}
            style={{ padding: '5px' }}
          />
          <textarea
            placeholder="Контент заметки..."
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            rows={2}
            style={{ padding: '5px', resize: 'none' }}
          />
          <button type="submit" style={{ padding: '6px' }}>
            + Добавить заметку
          </button>
        </form>
      </div>

      {/* 📖 3. ПРАВАЯ ПАНЕЛЬ (Просмотр, версионирование, архивация и тегирование) */}
      <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        {activeNoteId ? (
          <div>
            {/* Шапка панели: Заголовок + Ультимативная кнопка удаления */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '5px',
              }}
            >
              <h2 style={{ margin: 0 }}>{activeNote?.title}</h2>

              {/* 🎯 КНОПКА МЯГКОГО УДАЛЕНИЯ (АРХИВАЦИИ) ЗАМЕТКИ */}
              <button
                onClick={() => {
                  if (
                    confirm(
                      'Удалить заметку в архив? Она скроется из списков, а индекс пересчитает оперативную память.'
                    )
                  ) {
                    archiveNoteMutation.mutate(activeNoteId);
                  }
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

            {/* Метаданные оптимистичного замка */}
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

            {/* 🎯 ФОРМА ПРИВЯЗКИ ТЕГОВ (Many-to-Many подсистема) */}
            <form
              onSubmit={handleAttachTag}
              style={{ marginBottom: '20px', display: 'flex', gap: '5px' }}
            >
              <input
                type="text"
                placeholder="Новый хэштег (например: sql)..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                disabled={attachTagMutation.isPending}
                style={{
                  padding: '5px',
                  width: '200px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                }}
              />
              <button
                type="submit"
                disabled={attachTagMutation.isPending}
                style={{
                  padding: '5px 12px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
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

            {/* 🎯 ЛЕНИВЫЙ РЕНДЕР ТЕКСТА: Запрос улетает к Fastify только при клике! */}
            {contentLoading ? (
              <p style={{ color: '#aaa', fontStyle: 'italic' }}>
                Синхронизация синапса знаний с Podman...
              </p>
            ) : (
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
            )}
          </div>
        ) : (
          /* Состояние заглушки (Empty State), если ни одна карточка не выбрана */
          <div
            style={{
              color: '#888',
              textAlign: 'center',
              marginTop: '150px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <span style={{ fontSize: '40px' }}>🧠</span>
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
              Среда Synapse KMS готова к работе
            </div>
            <div style={{ fontSize: '13px', color: '#aaa' }}>
              Выберите любую заметку из центральной ленты для открытия графа
              знаний
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
