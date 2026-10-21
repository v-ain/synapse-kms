import { type ReactNode, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useSystemSubscription } from '@/hooks/useSystemSubscription';
import { trpc } from '@/utils/trpc';

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * ВНУТРЕННИЙ СЛОЙ: Вызывается ТОЛЬКО когда юзер 100% авторизован.
 * Монтируется один раз, предотвращая любые баги двойных подписок и реконнектов!
 */
function SystemEventSubscriber() {
  // Хук вызывается в изолированном компоненте, который не ререндерится от getMe
  useSystemSubscription();
  return null; // Он ничего не рендерит, это чистая инфраструктура
}

/**
 *  ВНЕШНИЙ СЛОЙ: Контролирует сессию и защищает стейт
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const { isAuthed, isInitializing, setProfile, clearProfile } = useAuthStore();

  // Проверяем сессию по HttpOnly кукам при старте приложения или при F5
  const {
    data: me,
    error,
    isLoading,
  } = trpc.users.getMe.useQuery(undefined, {
    retry: false,
    staleTime: Infinity,
    enabled: isInitializing, // Запускаем проверку только один раз при старте приложения
  });

  useEffect(() => {
    if (me) {
      // Передаем профиль строго по твоему контракту Zustand стора
      setProfile({
        id: me.id,
        email: me.email,
        role: me.role || 'user',
      });
    } else if (error) {
      clearProfile();
    }
  }, [me, error, setProfile, clearProfile]);

  // Экран инициализации приложения
  if (isLoading && isInitializing) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 dark:bg-slate-950 text-sm font-mono text-slate-400 animate-pulse">
        [synapse] восстановление сессии...
      </div>
    );
  }

  return (
    <>
      {/* Магия: если авторизован — монтируем подписчик. Разлогинился — он уничтожается вместе с SSE */}
      {isAuthed && <SystemEventSubscriber />}
      {children}
    </>
  );
}
