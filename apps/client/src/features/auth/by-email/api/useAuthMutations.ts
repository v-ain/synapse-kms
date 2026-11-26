import { trpc } from '@/shared/api/trpc';
import { useAuthStore } from '@/entities/user';

export function useLogin() {
  const setProfile = useAuthStore((state) => state.setProfile);

  return trpc.auth.login.useMutation({
    onSuccess: (data) => {
      setProfile({
        id: data.user.id,
        username: data.user.username,
        role: data.user.role || 'user',
      });
    },
  });
}

export function useRegister() {
  const setProfile = useAuthStore((state) => state.setProfile);

  return trpc.auth.register.useMutation({
    onSuccess: (data) => {
      setProfile({
        id: data.user.id,
        username: data.user.username,
        role: data.user.role || 'user',
      });
    },
  });
}
