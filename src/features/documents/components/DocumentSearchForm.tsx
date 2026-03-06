'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ProgressBar } from '@/components/feedback/ProgressBar';
import { useToast } from '@/components/feedback/ToastProvider';

interface SearchResult {
  document_id: string | null;
  name?: string;
  text?: string;
  fts_score?: number;
  semantic_score?: number;
  combined_score: number;
  metadata?: Record<string, unknown>;
}

interface SearchResponse {
  results: SearchResult[];
  mode: 'fts' | 'semantic' | 'hybrid';
  response_time: number;
}

type SearchMode = 'fts' | 'semantic' | 'hybrid';

interface DocumentSearchState {
  query: string;
  mode: SearchMode;
  searching: boolean;
  results: SearchResult[];
  error: string | null;
  responseTime: number;
}

export function DocumentSearchForm({
  onResultsChange,
}: {
  onResultsChange?: (results: SearchResult[], mode: SearchMode, responseTime: number) => void;
}) {
  const [state, setState] = useState<DocumentSearchState>({
    query: '',
    mode: 'hybrid',
    searching: false,
    results: [],
    error: null,
    responseTime: 0,
  });

  const debounceTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  const { show } = useToast();

  // Validate search query
  function validateQuery(query: string): string | null {
    if (!query || query.trim().length === 0) {
      return '검색어를 입력해주세요';
    }
    if (query.trim().length < 2) {
      return '검색어는 최소 2자 이상이어야 합니다';
    }
    return null;
  }

  // Perform search
  async function performSearch(searchQuery: string) {
    const validationError = validateQuery(searchQuery);
    if (validationError) {
      setState((s) => ({ ...s, error: validationError, results: [] }));
      show(validationError, 'error');
      return;
    }

    setState((s) => ({ ...s, searching: true, error: null }));

    try {
      const params = new URLSearchParams({
        q: searchQuery.trim(),
        mode: state.mode,
      });

      const response = await fetch(`/api/documents/search?${params}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        const errorMessage = errorData.error || 'Search failed';
        setState((s) => ({
          ...s,
          searching: false,
          error: errorMessage,
          results: [],
        }));
        show(errorMessage, 'error');
        return;
      }

      const data = (await response.json()) as SearchResponse;
      setState((s) => ({
        ...s,
        searching: false,
        results: data.results,
        error: null,
        responseTime: data.response_time,
      }));

      if (onResultsChange) {
        onResultsChange(data.results, data.mode, data.response_time);
      }

      if (data.results.length === 0) {
        show('검색어와 일치하는 문서를 찾지 못했습니다', 'info');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed';
      setState((s) => ({
        ...s,
        searching: false,
        error: message,
        results: [],
      }));
      show(message, 'error');
    }
  }

  // Handle query input with debounce
  const handleQueryChange = useCallback(
    (query: string) => {
      setState((s) => ({ ...s, query }));

      // Clear existing timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // Set new timer for debounced search (500ms)
      debounceTimer.current = setTimeout(() => {
        void performSearch(query);
      }, 500);
    },
    [state.mode]
  );

  // Handle mode change
  const handleModeChange = (mode: SearchMode) => {
    setState((s) => ({ ...s, mode }));
    // Re-search with new mode if query exists
    if (state.query.trim()) {
      void performSearch(state.query);
    }
  };

  // Handle manual search (on button click or Enter)
  const handleSearch = () => {
    // Clear debounce timer and perform immediate search
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    void performSearch(state.query);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>문서 검색</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search input */}
        <div className="space-y-2">
          <input
            type="text"
            placeholder="검색어를 입력하세요..."
            value={state.query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={state.searching}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            data-testid="search-input"
          />
          {state.error && (
            <p className="text-sm text-red-600" data-testid="error-message">
              {state.error}
            </p>
          )}
        </div>

        {/* Mode selector */}
        <div className="flex gap-2">
          {(['fts', 'semantic', 'hybrid'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              disabled={state.searching}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                state.mode === mode
                  ? 'bg-primary text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              } disabled:opacity-50`}
              data-testid={`mode-${mode}`}
            >
              {mode === 'fts'
                ? 'FTS'
                : mode === 'semantic'
                  ? 'Semantic'
                  : 'Hybrid'}
            </button>
          ))}
        </div>

        {/* Search button and loading state */}
        <div className="flex gap-2">
          <button
            onClick={handleSearch}
            disabled={state.searching || !state.query.trim()}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="search-button"
          >
            {state.searching ? '검색 중...' : '검색'}
          </button>
        </div>

        {/* Loading progress */}
        {state.searching && (
          <ProgressBar value={50} label="검색 중..." />
        )}

        {/* Results summary */}
        {!state.searching && state.results.length > 0 && (
          <div className="text-sm text-gray-600 space-y-2">
            <p data-testid="results-summary">
              {state.results.length}개의 문서를 찾았습니다
              {state.responseTime > 0 && ` (${state.responseTime}ms)`}
            </p>

            {/* Results list */}
            <div className="space-y-3 mt-4" data-testid="results-list">
              {state.results.map((result, idx) => (
                <div
                  key={`${result.document_id}-${idx}`}
                  className="p-3 border border-gray-200 rounded-md bg-gray-50"
                  data-testid={`result-item-${idx}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">
                        {result.name || 'Untitled Document'}
                      </h4>
                      {result.text && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {result.text}
                        </p>
                      )}
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <div
                        className="text-sm font-semibold text-green-600"
                        data-testid={`result-score-${idx}`}
                      >
                        {(result.combined_score * 100).toFixed(0)}%
                      </div>
                      {state.mode === 'hybrid' && (
                        <div className="text-xs text-gray-500 mt-1">
                          {result.fts_score !== undefined && (
                            <div>FTS: {(result.fts_score * 100).toFixed(0)}%</div>
                          )}
                          {result.semantic_score !== undefined && (
                            <div>Semantic: {(result.semantic_score * 100).toFixed(0)}%</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!state.searching && state.results.length === 0 && !state.error && state.query && (
          <p className="text-center text-gray-500 py-8">
            문서를 찾지 못했습니다. 다른 검색어를 시도해주세요.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
