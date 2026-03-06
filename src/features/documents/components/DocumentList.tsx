"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";

export interface DocumentItem {
  id: string;
  name: string;
  size: number;
  status: "waiting" | "done" | "failed";
  created_at: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toISOString().slice(0, 10);
}

function statusVariant(
  status: DocumentItem["status"]
): "default" | "secondary" | "destructive" {
  if (status === "done") return "default";
  if (status === "failed") return "destructive";
  return "secondary";
}

function statusLabel(status: DocumentItem["status"]): string {
  if (status === "done") return "completed";
  if (status === "failed") return "error";
  return "pending";
}

export default function DocumentList() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/documents")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        return res.json() as Promise<DocumentItem[]>;
      })
      .then((data) => {
        if (!cancelled) {
          setDocuments(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load documents"
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = useCallback(async (doc: DocumentItem) => {
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    setDeleteError(null);

    try {
      const res = await fetch(`/api/documents/${doc.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
    } catch (err: unknown) {
      setDocuments((prev) => {
        const already = prev.some((d) => d.id === doc.id);
        if (already) return prev;
        return [...prev, doc].sort(
          (a, b) =>
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
        );
      });
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete document"
      );
    }
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent>
          <div
            role="status"
            aria-label="Loading documents"
            className="flex items-center justify-center py-8 text-muted-foreground"
          >
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <p className="py-8 text-center text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
      </CardHeader>
      <CardContent>
        {deleteError && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {deleteError}
          </p>
        )}
        {documents.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            No documents uploaded yet
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">File name</th>
                <th className="pb-2 pr-4 font-medium">Upload date</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Size</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-b last:border-0">
                  <td className="py-3 pr-4">{doc.name}</td>
                  <td className="py-3 pr-4">{formatDate(doc.created_at)}</td>
                  <td className="py-3 pr-4">
                    <Badge variant={statusVariant(doc.status)}>
                      {statusLabel(doc.status)}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4">{formatFileSize(doc.size)}</td>
                  <td className="py-3">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleDelete(doc)}
                      aria-label={`Delete ${doc.name}`}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
