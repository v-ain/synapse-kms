import { useEffect } from 'react';
import { trpc } from '@/utils/trpc';
import { useAuthStore } from '@/store/useAuthStore';
import { useSystemSubscription } from '@/hooks/useSystemSubscription';

export function UserLayout() {
  const setProfile = useAuthStore((state) => state.setProfile);
  const clearProfile = useAuthStore((state) => state.clearProfile);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  useSystemSubscription();
  // Запрашиваем профиль. tRPC автоматически прокинет HttpOnly куки с запросом.
  const {
    data: user,
    error,
    isLoading,
  } = trpc.users.getMe.useQuery(undefined, {
    retry: false, // Если 401 UNAUTHORIZED — ретраить не нужно
    staleTime: Infinity, // Профиль статичен в рамках одной сессии
  });

  useEffect(() => {
    if (user) {
      setProfile(user);
    } else if (error) {
      clearProfile();
    }
  }, [user, error, setProfile, clearProfile]);

  if (isLoading || !isInitialized) {
    return <div>SYNAPSE KMS: СИНХРОНИЗАЦИЯ СЕССИИ...</div>;
  }

  return <>{user?.email?.slice(0, 7)}</>;
}
