import { useAuthStore } from '@/store/useAuthStore';

export function UserAvatar() {
  const username = useAuthStore((state) => state.username);
  const userInitial = username ? username.charAt(1).toUpperCase() : '?';
  console.log('[UI] Рендер аватарки для email:', username);
  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-900/50 font-mono text-sm font-bold shadow-sm select-none"
      title={username || 'Пользователь'}
    >
      {userInitial}
    </div>
  );
}
