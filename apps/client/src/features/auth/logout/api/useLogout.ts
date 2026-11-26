import { trpc } from '@/shared/api/trpc';
import { useAuthStore } from '@/entities/user';

export function useLogout() {
  const clearProfile = useAuthStore((state) => state.clearProfile);

  return trpc.auth.logout.useMutation({
    onSuccess: () => {
      clearProfile();
    },
    onError: (error) => {
      console.error('[Auth Error] Не удалось разлогиниться:', error.message);
      clearProfile();
    },
  });
}
