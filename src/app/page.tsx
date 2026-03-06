'use client';

import { useState } from 'react';
import { DocumentUpload } from '@/features/documents/components/DocumentUpload';
import { DocumentSearchForm } from '@/features/documents/components/DocumentSearchForm';
import { SearchResults } from '@/features/documents/components/SearchResults';

interface SearchResult {
  document_id: string | null;
  name?: string;
  text?: string;
  fts_score?: number;
  semantic_score?: number;
  combined_score: number;
  metadata?: Record<string, unknown>;
}

export default function DashboardPage() {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchMode, setSearchMode] = useState<'fts' | 'semantic' | 'hybrid'>('hybrid');
  const [responseTime, setResponseTime] = useState(0);

  const handleSearchResults = (
    results: SearchResult[],
    mode: 'fts' | 'semantic' | 'hybrid',
    time: number
  ) => {
    setSearchResults(results);
    setSearchMode(mode);
    setResponseTime(time);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">LoomQuery</h1>
          <p className="text-gray-600 mt-2">로컬 Ollama 기반 문서 검색 및 관리</p>
        </div>

        {/* Two-column layout for upload and search */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Upload section */}
          <div>
            <DocumentUpload />
          </div>

          {/* Search section */}
          <div>
            <DocumentSearchForm onResultsChange={handleSearchResults} />
          </div>
        </div>

        {/* Results section - full width */}
        {searchResults.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                검색 결과 ({searchResults.length}개)
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Mode: <span className="font-semibold">{searchMode}</span>
                {responseTime > 0 && ` • Response time: ${responseTime}ms`}
              </p>
            </div>
            <SearchResults results={searchResults} />
          </div>
        )}

        {/* Empty state */}
        {searchResults.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500">
              좌측에서 문서를 업로드하고, 우측에서 검색해보세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
