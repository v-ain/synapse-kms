import React, { useState } from 'react';
import { trpc } from '@/utils/trpc.js'; // Проверьте правильность пути к вашему trpc
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

interface AuthFormProps {
  onAuthSuccess: () => void;
}

export const AuthForm = ({ onAuthSuccess }: AuthFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Настройка tRPC мутаций
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      setErrorMessage('');
      onAuthSuccess();
    },
    onError: (error) => setErrorMessage(error.message),
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      setErrorMessage('');
      onAuthSuccess();
    },
    onError: (error) => setErrorMessage(error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { email, password };

    if (isRegister) {
      registerMutation.mutate(payload);
    } else {
      loginMutation.mutate(payload);
    }
  };

  const isLoading = loginMutation.isPending || registerMutation.isPending;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-900">
      <Card className="w-full max-w-md shadow-lg border-slate-200/80">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">
            {isRegister ? 'Создать аккаунт' : 'Войти в Хаб'}
          </CardTitle>
          <CardDescription>
            {isRegister
              ? 'Введите данные для регистрации нового пользователя'
              : 'Введите ваш email и пароль для доступа к заметкам'}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* Вывод ошибки */}
            {errorMessage && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">
                {errorMessage}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Email
              </label>
              <Input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Пароль
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isRegister ? 'Зарегистрироваться' : 'Войти'}
            </Button>

            <Button
              type="button"
              variant="link"
              className="text-xs text-slate-500 hover:text-slate-900"
              onClick={() => {
                setIsRegister(!isRegister);
                setErrorMessage('');
              }}
              disabled={isLoading}
            >
              {isRegister
                ? 'Уже есть аккаунт? Войти'
                : 'Нет аккаунта? Зарегистрироваться'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};
