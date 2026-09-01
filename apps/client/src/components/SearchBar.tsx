import { useState, useEffect } from 'react';
import { useUIStore } from '../store';

export const SearchBar = () => {
  const { setSearchQuery } = useUIStore(); // метод, который меняет searchQuery в сторе
  const [localValue, setLocalValue] = useState('');

  useEffect(() => {
    // Ждем 300мс после окончания ввода, прежде чем триггерить перезапуск бесконечной ленты tRPC
    const timer = setTimeout(() => {
      setSearchQuery(localValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [localValue, setSearchQuery]);

  return (
    <div className="p-4 border-b border-gray-100 bg-white">
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder="Поиск по контенту и заголовкам..."
        className="w-full p-2 text-sm border rounded bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
      />
    </div>
  );
};
