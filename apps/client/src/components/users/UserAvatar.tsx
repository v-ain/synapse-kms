import { useAuthStore } from '@/store/useAuthStore';

export function UserAvatar() {
  const email = useAuthStore((state) => state.email);
  const userInitial = email ? email.charAt(0).toUpperCase() : '?';
  console.log('[UI] Рендер аватарки для email:', email);
  return (
    <div
      className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-900/50 font-mono text-sm font-bold shadow-sm select-none"
      title={email || 'Пользователь'}
    >
      {userInitial}
    </div>
  );
}
