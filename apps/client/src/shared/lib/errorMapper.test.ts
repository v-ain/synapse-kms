import { describe, it, expect } from 'vitest';
import { ZodError, type ZodIssue } from 'zod';
import { mapZodErrorToUi } from './errorMapper';

// Хелпер для быстрой генерации ZodError из массива кастомных issues
function createMockZodError(messageCode: string): ZodError {
  const issue: ZodIssue = {
    code: 'custom',
    path: ['title'],
    message: messageCode, // наш код-ключ: TITLE_EMPTY, CONTENT_TOO_LONG и т.д.
  };
  return new ZodError([issue]);
}

describe('mapZodErrorToUi', () => {
  it('должен правильно переводить код ошибки пустого заголовка', () => {
    const error = createMockZodError('TITLE_EMPTY');
    const result = mapZodErrorToUi(error);
    expect(result).toBe('Заголовок не может быть пустым.');
  });

  it('должен правильно переводить код слишком длинного заголовка', () => {
    const error = createMockZodError('TITLE_TOO_LONG');
    const result = mapZodErrorToUi(error);
    expect(result).toBe('Заголовок не должен превышать 100 символов.');
  });

  it('должен возвращать дефолтный текст, если код ошибки неизвестен', () => {
    const error = createMockZodError('SOME_UNKNOWN_CRITICAL_ERROR');
    const result = mapZodErrorToUi(error);
    expect(result).toBe('SOME_UNKNOWN_CRITICAL_ERROR');
  });
});
