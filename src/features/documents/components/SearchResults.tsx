"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface SearchResult {
  document_id: string | null;
  name?: string;
  text?: string;
  fts_score?: number;
  semantic_score?: number;
  combined_score: number;
  metadata?: Record<string, unknown>;
}

interface SearchResultsProps {
  results?: SearchResult[];
}

export function SearchResults({ results = [] }: SearchResultsProps) {

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3" data-testid="results-list">
      {results.map((result, index) => (
        <Card key={`${result.document_id}-${index}`} data-testid={`result-item-${index}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {result.name || result.document_id || "Untitled Document"}
              </CardTitle>
              <Badge variant="secondary" data-testid={`result-score-${index}`}>
                {Math.round(result.combined_score * 100)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {result.text
                ? result.text.slice(0, 200) + (result.text.length > 200 ? "..." : "")
                : "No preview available"}
            </p>
            {result.metadata?.created_at && typeof result.metadata.created_at === 'string' ? (
              <p className="text-xs text-gray-400">
                업로드: {new Date(result.metadata.created_at).toLocaleDateString('ko-KR')}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
