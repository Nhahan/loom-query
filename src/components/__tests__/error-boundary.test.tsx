import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorBoundary } from '../feedback/ErrorBoundary';
import React from 'react';

vi.mock('@/lib/i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      'error.title': '문제가 발생했습니다',
      'error.description': '예상치 못한 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      'error.retry': '다시 시도',
    };
    return map[key] ?? key;
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test error');
  return <div>No error</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when there is no error', async () => {
    await act(async () => {
      render(
        <ErrorBoundary>
          <span>Normal content</span>
        </ErrorBoundary>
      );
    });
    expect(screen.getByText('Normal content')).toBeInTheDocument();
  });

  it('catches errors and displays Korean error message', async () => {
    await act(async () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );
    });
    expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument();
  });

  it('displays a retry button', async () => {
    await act(async () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );
    });
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
  });

  it('resets error state when retry is clicked', async () => {
    let shouldThrow = true;

    function MutableComponent() {
      if (shouldThrow) throw new Error('Retryable error');
      return <div>Recovered</div>;
    }

    await act(async () => {
      render(
        <ErrorBoundary>
          <MutableComponent />
        </ErrorBoundary>
      );
    });
    expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument();

    shouldThrow = false;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    });
    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('renders custom fallback when provided', async () => {
    await act(async () => {
      render(
        <ErrorBoundary fallback={<div>Custom fallback</div>}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );
    });
    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
  });

  it('logs the error via structured logger', async () => {
    const { logger } = await import('@/lib/logger');
    await act(async () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );
    });
    expect(logger.error).toHaveBeenCalledWith(
      'ErrorBoundary caught an error',
      expect.objectContaining({ message: 'Test error' })
    );
  });
});
