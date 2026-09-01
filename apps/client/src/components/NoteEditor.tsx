import { useState, useEffect } from 'react';
import { useUpdateNote } from '../hooks.js';

interface EditorProps {
  note: { id: string; content: string; version: number; title: string };
}

export const NoteEditor = ({ note }: EditorProps) => {
  const [text, setText] = useState(note.content);
  const updateNoteMutation = useUpdateNote();

  // Синхронизируем локальный стейт, если пользователь переключил заметку в стиле ranger
  useEffect(() => {
    setText(note.content);
  }, [note.id, note.content]);

  // Эффект автосохранения контента
  useEffect(() => {
    // Если текст не менялся относительно исходного — ничего не делаем
    if (text === note.content) return;

    // Взводим таймер на 1 секунду после последней нажатой клавиши
    const timer = setTimeout(() => {
      updateNoteMutation.mutate({
        id: note.id,
        version: note.version, // отправляем текущую версию
        content: text,
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [text, note.id, note.version, note.content]);

  return (
    <div className="flex flex-col h-full font-mono text-sm">
      {/* Статус-бар в стиле ranger снизу или сверху */}
      <div className="text-xs text-gray-400 p-1 bg-gray-900 select-none">
        {updateNoteMutation.isPending
          ? '💾 Сохранение...'
          : `v${note.version} | Слов: ${text.split(/\s+/).filter(Boolean).length}`}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full h-full p-4 bg-transparent resize-none focus:outline-none font-mono leading-relaxed"
      />
    </div>
  );
};
