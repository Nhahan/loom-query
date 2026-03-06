import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock useToast
const toastMocks = vi.hoisted(() => ({ show: vi.fn() }));
vi.mock('@/components/feedback/ToastProvider', () => ({
  useToast: () => ({ show: toastMocks.show }),
}));

// Mock fetch
let mockFetchResponse: { ok: boolean; json: () => Promise<unknown> };
vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(mockFetchResponse)));

import { DocumentSearchForm } from '../DocumentSearchForm';

const mockSearchResults = {
  results: [
    {
      document_id: 'doc-1',
      name: 'Document One',
      text: 'This is the first document',
      combined_score: 0.95,
      fts_score: 0.9,
      semantic_score: 1.0,
    },
    {
      document_id: 'doc-2',
      name: 'Document Two',
      text: 'This is the second document',
      combined_score: 0.75,
      fts_score: 0.7,
      semantic_score: 0.8,
    },
  ],
  mode: 'hybrid' as const,
  response_time: 150,
};

beforeEach(() => {
  vi.clearAllMocks();
  toastMocks.show.mockClear();
  mockFetchResponse = {
    ok: true,
    json: () => Promise.resolve(mockSearchResults),
  };
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(mockFetchResponse)));
});

describe('DocumentSearchForm', () => {
  it('renders search input and button', () => {
    render(<DocumentSearchForm />);
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByTestId('search-button')).toBeInTheDocument();
  });

  it('renders mode selector buttons', () => {
    render(<DocumentSearchForm />);
    expect(screen.getByTestId('mode-fts')).toBeInTheDocument();
    expect(screen.getByTestId('mode-semantic')).toBeInTheDocument();
    expect(screen.getByTestId('mode-hybrid')).toBeInTheDocument();
  });

  it('search button is disabled with empty query', () => {
    render(<DocumentSearchForm />);
    const button = screen.getByTestId('search-button') as HTMLButtonElement;

    expect(button.disabled).toBe(true);
  });

  it('rejects query shorter than 2 characters', async () => {
    render(<DocumentSearchForm />);
    const input = screen.getByTestId('search-input') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { value: 'a' } });
      fireEvent.click(screen.getByTestId('search-button'));
    });

    expect(toastMocks.show).toHaveBeenCalledWith(
      'Search query must be at least 2 characters',
      'error'
    );
  });

  it('displays search results with scores', async () => {
    render(<DocumentSearchForm />);
    const input = screen.getByTestId('search-input') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { value: 'test query' } });
      fireEvent.click(screen.getByTestId('search-button'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('results-list')).toBeInTheDocument();
      expect(screen.getByTestId('result-item-0')).toBeInTheDocument();
      expect(screen.getByTestId('result-score-0')).toHaveTextContent('95%');
    });
  });

  it('supports search mode switching', async () => {
    render(<DocumentSearchForm />);
    const semanticButton = screen.getByTestId('mode-semantic') as HTMLButtonElement;

    await act(async () => {
      fireEvent.click(semanticButton);
    });

    expect(semanticButton.className).toContain('bg-primary');
  });

  it('handles search API errors gracefully', async () => {
    mockFetchResponse = {
      ok: false,
      json: () => Promise.resolve({ error: 'API error' }),
    };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(mockFetchResponse)));

    render(<DocumentSearchForm />);
    const input = screen.getByTestId('search-input') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.click(screen.getByTestId('search-button'));
    });

    await waitFor(() => {
      expect(toastMocks.show).toHaveBeenCalledWith('API error', 'error');
    });
  });

  it('handles network errors', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Network failed'))));

    render(<DocumentSearchForm />);
    const input = screen.getByTestId('search-input') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.click(screen.getByTestId('search-button'));
    });

    await waitFor(() => {
      expect(toastMocks.show).toHaveBeenCalledWith('Network failed', 'error');
    });
  });

  it('disables search button when query is empty', () => {
    render(<DocumentSearchForm />);
    const button = screen.getByTestId('search-button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('calls onResultsChange callback with results', async () => {
    const onResultsChange = vi.fn();
    render(<DocumentSearchForm onResultsChange={onResultsChange} />);
    const input = screen.getByTestId('search-input') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.click(screen.getByTestId('search-button'));
    });

    await waitFor(() => {
      expect(onResultsChange).toHaveBeenCalledWith(
        mockSearchResults.results,
        'hybrid',
        150
      );
    });
  });
});
