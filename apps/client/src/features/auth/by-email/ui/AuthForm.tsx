import React, { useState } from 'react';
import { useLogin, useRegister } from '../api/useAuthMutations';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card';
import { Loader2, Lock, Mail, AlertCircle, Brain, User } from 'lucide-react';

export const AuthForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isRegister, setIsRegister] = useState(false);

  const loginMutation = useLogin();
  const registerMutation = useRegister();

  const errorMessage =
    (isRegister
      ? registerMutation.error?.message
      : loginMutation.error?.message) || '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isRegister) {
      registerMutation.mutate({
        email,
        password,
        username: username.trim(),
        displayName: displayName.trim() || undefined,
      });
    } else {
      loginMutation.mutate({ email, password });
    }
  };

  const isLoading = loginMutation.isPending || registerMutation.isPending;

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-slate-50/50 dark:bg-slate-950">
      <Card className="w-full max-w-sm shadow-xl border-slate-200/60 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
        <CardHeader className="space-y-1 text-center pt-8">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-slate-50 dark:text-slate-900">
            <Brain className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">
            {isRegister ? 'Создать аккаунт' : 'Вход в систему'}
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            {isRegister
              ? 'Зарегистрируйтесь в Synapse KMS'
              : 'Введите свои данные для доступа к графу знаний'}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {errorMessage && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive font-medium animate-in fade-in slide-in-from-top-1 duration-150">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>{errorMessage}</p>
              </div>
            )}

            {isRegister && (
              <>
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-0.5">
                    Никнейм (для поиска и шаринга)
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <Input
                      type="text"
                      value={username}
                      onChange={(e) =>
                        setUsername(e.target.value.replace(/\s/g, ''))
                      }
                      placeholder="alex_dev"
                      className="pl-9 h-10 bg-slate-50/30 dark:bg-slate-900/30"
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-0.5">
                    Имя пользователя (опционально)
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <Input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Алексей Иванов"
                      className="pl-9 h-10 bg-slate-50/30 dark:bg-slate-900/30"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-0.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="pl-9 h-10 bg-slate-50/30 dark:bg-slate-900/30"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-0.5">
                Пароль
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 h-10 bg-slate-50/30 dark:bg-slate-900/30"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pb-8">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Синхронизация...
                </>
              ) : isRegister ? (
                'Создать синапс-аккаунт'
              ) : (
                'Войти в систему'
              )}
            </Button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                loginMutation.reset();
                registerMutation.reset();
                setIsRegister(!isRegister);
              }}
              className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 transition-colors pt-1"
            >
              {isRegister
                ? 'Уже есть аккаунт? Войти'
                : 'Нет аккаунта? Зарегистрироваться'}
            </button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};
