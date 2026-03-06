import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { SearchResults } from "../SearchResults";

interface SearchResult {
  document_id: string | null;
  name?: string;
  text?: string;
  fts_score?: number;
  semantic_score?: number;
  combined_score: number;
  metadata?: Record<string, unknown>;
}

describe("SearchResults", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when results array is empty", async () => {
    await act(async () => {
      const { container } = render(<SearchResults results={[]} />);
      expect(container.firstChild).toBeNull();
    });
  });

  it("renders result items when results are provided", async () => {
    const mockResults: SearchResult[] = [
      {
        document_id: "doc-1",
        name: "Test Document",
        text: "This is test content",
        combined_score: 0.95,
      },
    ];

    await act(async () => {
      render(<SearchResults results={mockResults} />);
    });

    expect(screen.getByTestId("result-item-0")).toBeInTheDocument();
    expect(screen.getByText("Test Document")).toBeInTheDocument();
  });

  it("displays document name when available", async () => {
    const mockResults: SearchResult[] = [
      {
        document_id: "doc-1",
        name: "My Document",
        text: "Content here",
        combined_score: 0.85,
      },
    ];

    await act(async () => {
      render(<SearchResults results={mockResults} />);
    });

    expect(screen.getByText("My Document")).toBeInTheDocument();
  });

  it("displays relevance score as percentage", async () => {
    const mockResults: SearchResult[] = [
      {
        document_id: "doc-1",
        name: "Document",
        text: "Content",
        combined_score: 0.75,
      },
    ];

    await act(async () => {
      render(<SearchResults results={mockResults} />);
    });

    const scoreElement = screen.getByTestId("result-score-0");
    expect(scoreElement).toHaveTextContent("75%");
  });

  it("displays document text preview (first 200 chars)", async () => {
    const longText = "a".repeat(300);
    const mockResults: SearchResult[] = [
      {
        document_id: "doc-1",
        name: "Document",
        text: longText,
        combined_score: 0.8,
      },
    ];

    await act(async () => {
      render(<SearchResults results={mockResults} />);
    });

    const preview = screen.getByText(/^a+\.\.\.$/);
    expect(preview).toBeInTheDocument();
  });

  it("shows 'No preview available' when text is missing", async () => {
    const mockResults: SearchResult[] = [
      {
        document_id: "doc-1",
        name: "Document",
        combined_score: 0.8,
      },
    ];

    await act(async () => {
      render(<SearchResults results={mockResults} />);
    });

    expect(screen.getByText("No preview available")).toBeInTheDocument();
  });

  it("displays document ID when name is not provided", async () => {
    const mockResults: SearchResult[] = [
      {
        document_id: "doc-123",
        text: "Content",
        combined_score: 0.9,
      },
    ];

    await act(async () => {
      render(<SearchResults results={mockResults} />);
    });

    expect(screen.getByText("doc-123")).toBeInTheDocument();
  });

  it("shows 'Untitled Document' when both name and document_id are missing", async () => {
    const mockResults: SearchResult[] = [
      {
        document_id: null,
        text: "Content",
        combined_score: 0.85,
      },
    ];

    await act(async () => {
      render(<SearchResults results={mockResults} />);
    });

    expect(screen.getByText("Untitled Document")).toBeInTheDocument();
  });

  it("renders multiple results correctly", async () => {
    const mockResults: SearchResult[] = [
      {
        document_id: "doc-1",
        name: "First Document",
        text: "First content",
        combined_score: 0.95,
      },
      {
        document_id: "doc-2",
        name: "Second Document",
        text: "Second content",
        combined_score: 0.85,
      },
      {
        document_id: "doc-3",
        name: "Third Document",
        text: "Third content",
        combined_score: 0.75,
      },
    ];

    await act(async () => {
      render(<SearchResults results={mockResults} />);
    });

    expect(screen.getByTestId("result-item-0")).toBeInTheDocument();
    expect(screen.getByTestId("result-item-1")).toBeInTheDocument();
    expect(screen.getByTestId("result-item-2")).toBeInTheDocument();
    expect(screen.getByText("First Document")).toBeInTheDocument();
    expect(screen.getByText("Second Document")).toBeInTheDocument();
    expect(screen.getByText("Third Document")).toBeInTheDocument();
  });

  it("renders result cards with correct document_id and text", async () => {
    const mockResults: SearchResult[] = [
      {
        document_id: "doc-abc",
        text: "This is a sample chunk of text from the document.",
        combined_score: 0.92,
        metadata: {},
      },
      {
        document_id: "doc-xyz",
        text: "Another relevant passage found in the corpus.",
        combined_score: 0.75,
        metadata: {},
      },
    ];

    await act(async () => {
      render(<SearchResults results={mockResults} />);
    });

    expect(screen.getByText("doc-abc")).toBeInTheDocument();
    expect(screen.getByText("doc-xyz")).toBeInTheDocument();
    expect(
      screen.getByText("This is a sample chunk of text from the document.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Another relevant passage found in the corpus.")
    ).toBeInTheDocument();
  });

  it("displays combined_score as a percentage badge", async () => {
    const mockResults: SearchResult[] = [
      {
        document_id: "doc-1",
        text: "Relevant text.",
        combined_score: 0.88,
        metadata: {},
      },
    ];

    await act(async () => {
      render(<SearchResults results={mockResults} />);
    });

    expect(screen.getByTestId("result-score-0")).toHaveTextContent("88%");
  });

  it("truncates text preview to 200 characters", async () => {
    const longText = "A".repeat(250);
    const mockResults: SearchResult[] = [
      {
        document_id: "doc-long",
        text: longText,
        combined_score: 0.5,
        metadata: {},
      },
    ];

    await act(async () => {
      render(<SearchResults results={mockResults} />);
    });

    const preview = screen.getByText(`${"A".repeat(200)}...`);
    expect(preview).toBeInTheDocument();
  });
});
