import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorDisplay } from '../feedback/ErrorDisplay';
import { AppError, ErrorCode } from '@/lib/errors';

vi.mock('@/lib/i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      'error.title': '문제가 발생했습니다',
      'error.code': '오류 코드',
      'error.recovery': '해결 방법',
    };
    return map[key] ?? key;
  },
}));

describe('ErrorDisplay', () => {
  it('renders the error title', async () => {
    const error = new AppError({ code: ErrorCode.INTERNAL_ERROR, message: '서버 오류' });
    await act(async () => { render(<ErrorDisplay error={error} />); });
    expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument();
  });

  it('renders the error code', async () => {
    const error = new AppError({ code: ErrorCode.PARSE_FAILED, message: '파싱 실패' });
    await act(async () => { render(<ErrorDisplay error={error} />); });
    expect(screen.getByText('PARSE_FAILED')).toBeInTheDocument();
  });

  it('renders the error message', async () => {
    const error = new AppError({ code: ErrorCode.SEARCH_FAILED, message: '검색 실패입니다' });
    await act(async () => { render(<ErrorDisplay error={error} />); });
    expect(screen.getByText('검색 실패입니다')).toBeInTheDocument();
  });

  it('renders recovery suggestion when provided', async () => {
    const error = new AppError({
      code: ErrorCode.RATE_LIMITED,
      message: '요청 한도 초과',
      recovery: '잠시 후 다시 시도해 주세요',
    });
    await act(async () => { render(<ErrorDisplay error={error} />); });
    expect(screen.getByText('해결 방법')).toBeInTheDocument();
    expect(screen.getByText('잠시 후 다시 시도해 주세요')).toBeInTheDocument();
  });

  it('does not render recovery section when recovery is absent', async () => {
    const error = new AppError({ code: ErrorCode.INTERNAL_ERROR, message: '오류' });
    await act(async () => { render(<ErrorDisplay error={error} />); });
    expect(screen.queryByText('해결 방법')).not.toBeInTheDocument();
  });

  it('renders traceId when provided', async () => {
    const error = new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message: '오류',
      traceId: 'abc-123',
    });
    await act(async () => { render(<ErrorDisplay error={error} />); });
    expect(screen.getByText(/abc-123/)).toBeInTheDocument();
  });

  it('has role="alert" for accessibility', async () => {
    const error = new AppError({ code: ErrorCode.INTERNAL_ERROR, message: '오류' });
    await act(async () => { render(<ErrorDisplay error={error} />); });
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
