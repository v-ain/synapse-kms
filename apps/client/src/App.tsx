import React from 'react';
import { Sidebar } from './components/Sidebar';
import { NotesList } from './components/NotesList';
import { NoteViewer } from './components/NoteViewer';

export default function App() {
  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      {/* Колонка 1: Папки и Навигация */}
      <Sidebar />

      {/* Колонка 2: Лента заметок и чекбоксы */}
      <NotesList />

      {/* Колонка 3: Ленивый просмотр содержимого */}
      <NoteViewer />
    </div>
  );
}
