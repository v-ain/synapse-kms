import { render, screen, act, fireEvent } from '@testing-library/react';
import { NoteEditor } from '../NoteEditor';
import { useUpdateNote } from '@/hooks';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Мокаем LWW-хук мутации
vi.mock('@/hooks', () => ({
  useUpdateNote: vi.fn(),
}));

const mockNote = {
  id: 'test-note-uuid',
  folderId: null,
  title: 'Тестовая заметка',
  content: 'Исходный текст синапса',
  isArchived: false,
  isDeleted: false,
  userId: 'user-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  clientUpdatedAt: new Date().toISOString(),
};

describe('NoteEditor — Интеграционное тестирование LWW и неконтролируемого DOM', () => {
  let mockUpdateNoteFn: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockUpdateNoteFn = vi.fn((payload, options) => {
      // Имитируем успешный мгновенный ответ для прохождения UI-тестов,
      // если компонент ожидает вызова onSuccess
      options?.onSuccess?.();
    });

    (useUpdateNote as any).mockReturnValue({
      updateNote: mockUpdateNoteFn,
      isPending: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('должен правильно инициализироваться с исходным контентом базы данных', () => {
    render(<NoteEditor note={mockNote} />);

    const textarea = screen.getByPlaceholderText(
      /Начните писать ваши мысли здесь/i
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe('Исходный текст синапса');
    expect(screen.getByText('Сохранено в KMS')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // Слов: 3
  });

  it('должен переводить статус в dirty при вводе и отправлять запрос по дебаунсу через 1000мс', () => {
    render(<NoteEditor note={mockNote} />);
    const textarea = screen.getByPlaceholderText(
      /Начните писать ваши мысли здесь/i
    );

    fireEvent.change(textarea, {
      target: { value: 'Исходный текст синапса новый контент' },
    });

    expect(
      screen.getByText('Есть несохраненные изменения')
    ).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // Слов: 5
    expect(mockUpdateNoteFn).not.toHaveBeenCalled();

    // Перематываем время дебаунса вперед
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockUpdateNoteFn).toHaveBeenCalledTimes(1);
    // Проверяем первый аргумент, а вторым ожидаем объект конфигурации колбэков
    expect(mockUpdateNoteFn).toHaveBeenCalledWith(
      {
        id: mockNote.id,
        content: 'Исходный текст синапса новый контент',
      },
      expect.any(Object)
    );
  });

  it('должен игнорировать дебаунс и сохранять данные немедленно по событию Blur', () => {
    render(<NoteEditor note={mockNote} />);
    const textarea = screen.getByPlaceholderText(
      /Начните писать ваши мысли здесь/i
    );

    fireEvent.change(textarea, {
      target: { value: 'Исходный текст синапса апдейт' },
    });
    expect(mockUpdateNoteFn).not.toHaveBeenCalled();

    fireEvent.blur(textarea);

    expect(mockUpdateNoteFn).toHaveBeenCalledTimes(1);
    expect(mockUpdateNoteFn).toHaveBeenCalledWith(
      {
        id: mockNote.id,
        content: 'Исходный текст синапса апдейт',
      },
      expect.any(Object)
    );
  });

  it('должен мгновенно блокировать ввод и показывать ошибку при превышении лимита в 5000 символов', () => {
    render(<NoteEditor note={mockNote} />);
    const textarea = screen.getByPlaceholderText(
      /Начните писать ваши мысли здесь/i
    );
    const hugeText = 'A'.repeat(5001);

    fireEvent.change(textarea, { target: { value: hugeText } });

    expect(
      screen.getByText('Превышен лимит в 5000 символов')
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockUpdateNoteFn).not.toHaveBeenCalled();
  });

  it('должен принудительно сбрасывать буфер изменений в сеть при размонтировании компонента', () => {
    const { unmount } = render(<NoteEditor note={mockNote} />);
    const textarea = screen.getByPlaceholderText(
      /Начните писать ваши мысли здесь/i
    );

    fireEvent.change(textarea, {
      target: { value: 'Исходный текст синапса финальный штрих' },
    });
    expect(mockUpdateNoteFn).not.toHaveBeenCalled();

    unmount();

    expect(mockUpdateNoteFn).toHaveBeenCalledTimes(1);
    expect(mockUpdateNoteFn).toHaveBeenCalledWith(
      {
        id: mockNote.id,
        content: 'Исходный текст синапса финальный штрих',
      },
      expect.any(Object)
    );
  });
});
