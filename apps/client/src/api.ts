import axios from 'axios';
import { useUIStore } from './store';

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ФИКС: Динамически подмешиваем ID пользователя в каждый запрос по сети!
api.interceptors.request.use((config) => {
  const userId = useUIStore.getState().currentUserId;
  if (userId) {
    config.headers['x-user-id'] = userId;
  }
  return config;
});
