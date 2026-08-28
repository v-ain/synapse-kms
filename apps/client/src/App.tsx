import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { NotesList } from './components/NotesList';
import { NoteViewer } from './components/NoteViewer';
import { AuthForm } from './components/AuthForm';

export default function App() {
  const [isAuthed, setIsAuthed] = useState(false);
  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      {!isAuthed ? (
        // Если не авторизован — показываем форму логина
        <AuthForm onAuthSuccess={() => setIsAuthed(true)} />
      ) : (
        <>
          <Sidebar />

          <NotesList />

          <NoteViewer />
        </>
      )}
    </div>
  );
}
