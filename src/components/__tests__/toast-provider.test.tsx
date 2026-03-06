import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Toast, ToastSeverity } from '../feedback/ToastProvider';

vi.mock('@/lib/i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      'common.close': '닫기',
    };
    return map[key] ?? key;
  },
}));

// Use vi.hoisted so mock state is available when vi.mock factory runs (hoisted to top)
const mocks = vi.hoisted(() => ({
  toasts: [] as Toast[],
  show: vi.fn(),
  dismiss: vi.fn(),
}));

// Mock zustand's create so useToastStore returns plain values (no React hooks)
vi.mock('zustand', () => ({
  create: () => {
    const useStore = (selector?: (s: typeof mocks) => unknown) => {
      if (typeof selector === 'function') return selector(mocks);
      return mocks;
    };
    useStore.getState = () => mocks;
    useStore.setState = vi.fn();
    useStore.subscribe = vi.fn();
    return useStore;
  },
}));

// Import after mocks are set up
import { ToastProvider, useToast } from '../feedback/ToastProvider';

describe('ToastProvider', () => {
  beforeEach(() => {
    mocks.toasts = [];
    mocks.show.mockClear();
    mocks.dismiss.mockClear();
  });

  it('renders children', async () => {
    await act(async () => {
      render(
        <ToastProvider>
          <span>child content</span>
        </ToastProvider>
      );
    });
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('renders toasts from the store', async () => {
    mocks.toasts = [
      { id: 'toast-1', message: 'Hello world', severity: 'info' as ToastSeverity },
    ];
    await act(async () => {
      render(
        <ToastProvider>
          <div />
        </ToastProvider>
      );
    });
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('shows an error severity toast with role=alert', async () => {
    mocks.toasts = [
      { id: 'toast-2', message: 'Error occurred', severity: 'error' as ToastSeverity },
    ];
    await act(async () => {
      render(
        <ToastProvider>
          <div />
        </ToastProvider>
      );
    });
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Error occurred');
  });

  it('calls dismiss when close button is clicked', async () => {
    mocks.toasts = [
      { id: 'toast-3', message: 'Dismiss me', severity: 'info' as ToastSeverity },
    ];
    await act(async () => {
      render(
        <ToastProvider>
          <div />
        </ToastProvider>
      );
    });
    expect(screen.getByText('Dismiss me')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    });
    expect(mocks.dismiss).toHaveBeenCalledWith('toast-3');
  });

  it('renders multiple toasts', async () => {
    mocks.toasts = [
      { id: 'toast-4', message: 'First toast', severity: 'info' as ToastSeverity },
      { id: 'toast-5', message: 'Second toast', severity: 'warning' as ToastSeverity },
    ];
    await act(async () => {
      render(
        <ToastProvider>
          <div />
        </ToastProvider>
      );
    });
    expect(screen.getByText('First toast')).toBeInTheDocument();
    expect(screen.getByText('Second toast')).toBeInTheDocument();
  });

  it('useToast returns a show function', () => {
    const toast = useToast();
    expect(typeof toast.show).toBe('function');
  });
});
