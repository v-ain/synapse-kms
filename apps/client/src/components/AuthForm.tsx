import React, { useState } from 'react';
import { trpc } from '../utils/trpc.js';

export const AuthForm = ({ onAuthSuccess }: { onAuthSuccess: () => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 🪄 tRPC мутации для логина и регистрации
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      setErrorMessage('');
      onAuthSuccess(); // Оповещаем приложение, что кука сидит в браузере!
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
    <div className="max-w-md mx-auto mt-20 p-6 border rounded-lg shadow-md bg-white">
      <h2 className="text-2xl font-bold mb-6 text-center">
        {isRegister ? 'Регистрация в Synapse' : 'Вход в Synapse'}
      </h2>

      {errorMessage && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Пароль</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:bg-gray-400 transition"
        >
          {isLoading ? 'Загрузка...' : isRegister ? 'Создать аккаунт' : 'Войти'}
        </button>
      </form>

      <div className="mt-4 text-center text-sm">
        <button
          type="button"
          onClick={() => setIsRegister(!isRegister)}
          className="text-blue-600 hover:underline"
        >
          {isRegister
            ? 'Уже есть аккаунт? Войти'
            : 'Нет аккаунта? Зарегистрироваться'}
        </button>
      </div>
    </div>
  );
};
