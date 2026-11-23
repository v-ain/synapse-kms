import { WorkspacePage } from '@/pages/workspace';
import { AuthForm } from '@/features/auth/by-email';
import { useAuthStore } from '@/entities/user';
import { ThemeProvider } from '@/shared/lib/theme';
import { AuthProvider } from './providers/AuthProvider';

export default function App() {
  const isAuthed = useAuthStore((state) => state.isAuthed);

  return (
    <ThemeProvider defaultTheme="system" storageKey="synapse-ui-theme">
      <AuthProvider>
        {!isAuthed ? (
          <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
            <AuthForm />
          </div>
        ) : (
          <WorkspacePage />
        )}
      </AuthProvider>
    </ThemeProvider>
  );
}
