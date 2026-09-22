import React, { useState } from 'react';
import { trpc } from '../utils/trpc.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2, Lock, Mail, AlertCircle, Brain } from 'lucide-react';

export const AuthForm = ({ onAuthSuccess }: { onAuthSuccess: () => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 🪄 tRPC мутации для логина и регистрации
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      setErrorMessage('');
      onAuthSuccess();
    },
    onError: (error) => {
      setErrorMessage(error.message);
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => {
      setErrorMessage('');
      onAuthSuccess();
    },
    onError: (error) => {
      setErrorMessage(error.message);
    },
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
    // Обертка центрирует форму по вертикали и горизонтали на экранах любых размеров
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-slate-50/50 dark:bg-slate-950">
      <Card className="w-full max-w-sm shadow-xl border-slate-200/60 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
        {/* Шапка формы с красивой иконкой синапса */}
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
            {/* Вывод ошибки через стильный деструктивный блок */}
            {errorMessage && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive font-medium animate-in fade-in slide-in-from-top-1 duration-150">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>{errorMessage}</p>
              </div>
            )}

            {/* Поле Email */}
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

            {/* Поле Пароля */}
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
            {/* Кнопка отправки формы в строгом стиле Nova */}
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

            {/* Переключатель режимов */}
            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                setErrorMessage('');
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
