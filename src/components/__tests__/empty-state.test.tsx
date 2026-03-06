import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EmptyState } from '../EmptyState';
import { FileQuestion } from 'lucide-react';

describe('EmptyState', () => {
  it('renders the title', async () => {
    await act(async () => { render(<EmptyState title="항목 없음" />); });
    expect(screen.getByText('항목 없음')).toBeInTheDocument();
  });

  it('renders the description when provided', async () => {
    await act(async () => { render(<EmptyState title="항목 없음" description="아직 항목이 없습니다" />); });
    expect(screen.getByText('아직 항목이 없습니다')).toBeInTheDocument();
  });

  it('does not render description when omitted', async () => {
    await act(async () => { render(<EmptyState title="항목 없음" />); });
    expect(screen.queryByText('아직 항목이 없습니다')).not.toBeInTheDocument();
  });

  it('renders an icon when provided', async () => {
    await act(async () => { render(<EmptyState title="항목 없음" icon={FileQuestion} />); });
    const iconWrapper = document.querySelector('[aria-hidden="true"]');
    expect(iconWrapper).toBeInTheDocument();
  });

  it('renders a CTA button when action is provided', async () => {
    const onClick = vi.fn();
    await act(async () => {
      render(
        <EmptyState
          title="항목 없음"
          action={{ label: '새로 만들기', onClick }}
        />
      );
    });
    expect(screen.getByRole('button', { name: '새로 만들기' })).toBeInTheDocument();
  });

  it('calls action.onClick when CTA button is clicked', async () => {
    const onClick = vi.fn();
    await act(async () => {
      render(
        <EmptyState
          title="항목 없음"
          action={{ label: '새로 만들기', onClick }}
        />
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '새로 만들기' }));
    });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not render a button when action is omitted', async () => {
    await act(async () => { render(<EmptyState title="항목 없음" />); });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
