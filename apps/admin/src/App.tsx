import { useState } from 'react';
import { NoteCard } from '@/components/notes/NoteCard';
import { AuthForm } from '@/components/auth/AuthForm';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut } from 'lucide-react';
import { useAdminNotes } from './hooks/hooksAdmin';
import { CreateNoteForm } from './components/notes/CreateNoteForm';

export default function App() {
  // Локальный стейт авторизации
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Вызываем хук получения заметок. Он сработает, только когда isAuthenticated === true
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch, // Функция для ручного обновления данных после логина
  } = useAdminNotes();

  const handleAuthSuccess = () => {
    setIsAuthenticated(true);
    refetch(); // Перезапрашиваем данные у сервера, так как кука уже проставилась
  };

  // 1. Если не авторизован
  if (!isAuthenticated) {
    return <AuthForm onAuthSuccess={handleAuthSuccess} />;
  }

  // 2. Если авторизован и данные загружаются
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  // 3. Если сервер вернул ошибку авторизации (например, кука протухла)
  if (isError) {
    // Если ошибка сообщает про 401/Unauthorized, можно автоматически сбрасывать стейт:
    // setIsAuthenticated(false);
    return (
      <div className="p-8 text-center text-red-500 max-w-md mx-auto mt-20">
        <p className="mb-4">Ошибка доступа: {error.message}</p>
        <Button onClick={() => setIsAuthenticated(false)}>
          Вернуться на вход
        </Button>
      </div>
    );
  }

  const allNotes = data?.pages.flatMap((page) => page.items) || [];

  return (
    <div className="min-h-screen bg-slate-50 p-8 dark:bg-slate-900">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Хедер с кнопкой Выхода */}
        <header className="flex items-center justify-between border-b pb-4 border-slate-200">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Synapse KMS | Панель администратора
            </h1>
            <p className="text-sm text-slate-500">
              Успешно авторизован через tRPC сессию
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-destructive gap-2"
            onClick={() => setIsAuthenticated(false)} // В идеале тут еще надо дернуть мутацию logout, если она есть
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </Button>
        </header>
        <CreateNoteForm />
        {allNotes.length === 0 ? (
          <div className="text-center p-12 bg-white rounded-lg border border-dashed text-slate-400">
            Заметок пока нет. Перекиньте сюда первую ссылку!
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allNotes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        )}

        {hasNextPage && (
          <div className="flex justify-center pt-4">
            <Button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              variant="outline"
            >
              {isFetchingNextPage ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                'Загрузить еще'
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
