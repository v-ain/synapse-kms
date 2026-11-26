import { ZodError } from 'zod';

const ERROR_DICTIONARY: Record<string, string> = {
  TITLE_EMPTY: 'Заголовок не может быть пустым.',
  TITLE_TOO_LONG: 'Заголовок не должен превышать 100 символов.',
  CONTENT_TOO_LONG: 'Содержимое заметки слишком большое (макс. 5000 символов).',
  INVALID_UUID: 'Некорректный идентификатор папки.',
};

export function mapZodErrorToUi(error: ZodError): string {
  const firstError = error.errors[0];

  if (!firstError) return 'Произошла ошибка валидации.';

  // Если код ошибки есть в нашем словаре — отдаем перевод, иначе дефолтный текст
  return (
    ERROR_DICTIONARY[firstError.message] ||
    firstError.message ||
    'Некорректные данные.'
  );
}
