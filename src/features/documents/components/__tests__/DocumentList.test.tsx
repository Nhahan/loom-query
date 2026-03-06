/**
 * DocumentList RTL tests
 *
 * We mock shadcn/ui components (which use radix-ui Slot) to avoid the
 * pnpm duplicate-React issue that manifests when radix-ui loads its own
 * React copy in a fresh vitest worker.
 */
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Capture React via vi.hoisted so the factory closures below can use it
// even though vi.mock calls are hoisted above all other imports.
const { createElement: h } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("react") as { createElement: typeof import("react").createElement };
});

// ── shadcn/ui stubs ───────────────────────────────────────────────────────────
vi.mock("@/components/ui/Button", () => ({
  Button: ({ children, onClick, ...rest }: Record<string, unknown>) =>
    h("button", { onClick: onClick as () => void, ...(rest as object) }, children as import("react").ReactNode),
}));

vi.mock("@/components/ui/Badge", () => ({
  Badge: ({ children, ...rest }: Record<string, unknown>) =>
    h("span", rest as object, children as import("react").ReactNode),
}));

vi.mock("@/components/ui/Card", () => ({
  Card:        ({ children, ...rest }: Record<string, unknown>) => h("div", rest as object, children as import("react").ReactNode),
  CardHeader:  ({ children, ...rest }: Record<string, unknown>) => h("div", rest as object, children as import("react").ReactNode),
  CardTitle:   ({ children, ...rest }: Record<string, unknown>) => h("div", rest as object, children as import("react").ReactNode),
  CardContent: ({ children, ...rest }: Record<string, unknown>) => h("div", rest as object, children as import("react").ReactNode),
}));

// ── component under test ──────────────────────────────────────────────────────
import DocumentList, { type DocumentItem } from "../DocumentList";

// ── fixtures ──────────────────────────────────────────────────────────────────
const sampleDocuments: DocumentItem[] = [
  { id: "doc-1", name: "report.pdf", size: 2621440, status: "done",    created_at: "2024-03-06T10:00:00.000Z" },
  { id: "doc-2", name: "notes.txt",  size: 1024,    status: "waiting", created_at: "2024-03-05T08:00:00.000Z" },
  { id: "doc-3", name: "data.csv",   size: 512,     status: "failed",  created_at: "2024-03-04T06:00:00.000Z" },
];

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

// ── tests ─────────────────────────────────────────────────────────────────────
describe("DocumentList", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows loading state initially", async () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));

    await act(async () => { render(<DocumentList />); });

    expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
  });

  it("renders document list with correct data after fetch", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(ok(sampleDocuments));

    await act(async () => { render(<DocumentList />); });

    await waitFor(() => expect(screen.getByText("report.pdf")).toBeInTheDocument());

    expect(screen.getByText("notes.txt")).toBeInTheDocument();
    expect(screen.getByText("data.csv")).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(screen.getByText("error")).toBeInTheDocument();
    expect(screen.getByText("2.5 MB")).toBeInTheDocument();
    expect(screen.getByText("1.0 KB")).toBeInTheDocument();
    expect(screen.getByText("512 B")).toBeInTheDocument();
    expect(screen.getByText("2024-03-06")).toBeInTheDocument();
    expect(screen.getByText("2024-03-05")).toBeInTheDocument();
  });

  it("shows empty state when no documents", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(ok([]));

    await act(async () => { render(<DocumentList />); });

    await waitFor(() =>
      expect(screen.getByText(/no documents uploaded yet/i)).toBeInTheDocument()
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("fetches documents from GET /api/documents on mount", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(ok([]));

    await act(async () => { render(<DocumentList />); });

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/documents"));
  });

  it("calls DELETE endpoint when delete button is clicked", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok(sampleDocuments))
      .mockResolvedValueOnce(ok({ success: true }));

    await act(async () => { render(<DocumentList />); });
    await waitFor(() => expect(screen.getByText("report.pdf")).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /delete report\.pdf/i }));
    });

    expect(fetch).toHaveBeenCalledWith("/api/documents/doc-1", { method: "DELETE" });
  });

  it("optimistically removes document from list before API responds", async () => {
    let resolveDelete!: (v: Response) => void;
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok(sampleDocuments))
      .mockReturnValueOnce(new Promise<Response>((r) => { resolveDelete = r; }));

    await act(async () => { render(<DocumentList />); });
    await waitFor(() => expect(screen.getByText("report.pdf")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /delete report\.pdf/i }));

    expect(screen.queryByText("report.pdf")).not.toBeInTheDocument();
    expect(screen.getByText("notes.txt")).toBeInTheDocument();

    await act(async () => { resolveDelete(ok({ success: true })); });
  });

  it("re-adds document and shows error alert on delete failure", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(ok(sampleDocuments))
      .mockResolvedValueOnce(ok({ error: "Not found" }, 404));

    await act(async () => { render(<DocumentList />); });
    await waitFor(() => expect(screen.getByText("report.pdf")).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /delete report\.pdf/i }));
    });

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
  });
});
