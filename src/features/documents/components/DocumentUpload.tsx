'use client';

import { create } from 'zustand';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/feedback/ProgressBar';
import { useToast } from '@/components/feedback/ToastProvider';

// ---- Upload store ----

interface UploadState {
  file: File | null;
  uploading: boolean;
  progress: number;
  isDragOver: boolean;
  uploadedDocumentId: string | null;
  validationError: string | null;
  setFile: (file: File | null) => void;
  setUploading: (uploading: boolean) => void;
  setProgress: (progress: number) => void;
  setIsDragOver: (isDragOver: boolean) => void;
  setUploadedDocumentId: (id: string | null) => void;
  setValidationError: (error: string | null) => void;
  reset: () => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  file: null,
  uploading: false,
  progress: 0,
  isDragOver: false,
  uploadedDocumentId: null,
  validationError: null,
  setFile: (file) => set({ file }),
  setUploading: (uploading) => set({ uploading }),
  setProgress: (progress) => set({ progress }),
  setIsDragOver: (isDragOver) => set({ isDragOver }),
  setUploadedDocumentId: (uploadedDocumentId) => set({ uploadedDocumentId }),
  setValidationError: (validationError) => set({ validationError }),
  reset: () => set({ file: null, uploading: false, progress: 0, isDragOver: false, uploadedDocumentId: null, validationError: null }),
}));

// ---- Helpers ----

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ALLOWED_FILE_TYPES = new Set(['application/pdf', 'text/plain']);
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export function validateFile(file: File): string | null {
  if (!ALLOWED_FILE_TYPES.has(file.type)) {
    return 'Only PDF and TXT files are allowed';
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'File size exceeds 50 MB limit';
  }
  return null;
}

interface UploadResponse {
  documentId: string;
  status: string;
  fileName: string;
}

// ---- Component ----

export function DocumentUpload() {
  const file = useUploadStore((s) => s.file);
  const uploading = useUploadStore((s) => s.uploading);
  const progress = useUploadStore((s) => s.progress);
  const isDragOver = useUploadStore((s) => s.isDragOver);
  const uploadedDocumentId = useUploadStore((s) => s.uploadedDocumentId);
  const validationError = useUploadStore((s) => s.validationError);
  const setFile = useUploadStore((s) => s.setFile);
  const setUploading = useUploadStore((s) => s.setUploading);
  const setProgress = useUploadStore((s) => s.setProgress);
  const setIsDragOver = useUploadStore((s) => s.setIsDragOver);
  const setUploadedDocumentId = useUploadStore((s) => s.setUploadedDocumentId);
  const setValidationError = useUploadStore((s) => s.setValidationError);
  const reset = useUploadStore((s) => s.reset);
  const { show } = useToast();

  function handleButtonClick() {
    const input = document.getElementById('upload-file-input') as HTMLInputElement | null;
    input?.click();
  }

  async function uploadFile(selectedFile: File) {
    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const data = await new Promise<UploadResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const pct = Math.round((event.loaded / event.total) * 100);
            setProgress(pct);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const responseData = JSON.parse(xhr.responseText) as UploadResponse;
              resolve(responseData);
            } catch {
              reject(new Error('Invalid response format'));
            }
          } else {
            let message = 'Upload failed';
            try {
              const body = JSON.parse(xhr.responseText) as { error?: string };
              if (body.error) message = body.error;
            } catch {
              // ignore parse error
            }
            reject(new Error(message));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error'));
        });

        xhr.open('POST', '/api/documents/upload');
        xhr.send(formData);
      });

      setProgress(100);
      setUploadedDocumentId(data.documentId);
      show(`Document uploaded successfully (ID: ${data.documentId})`, 'info');
      reset();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      show(message, 'error');
      setUploading(false);
    }
  }

  function handleFileSelect(selectedFile: File) {
    const error = validateFile(selectedFile);
    if (error) {
      setValidationError(error);
      show(error, 'error');
      return;
    }
    setValidationError(null);
    setFile(selectedFile);
    void uploadFile(selectedFile);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    if (uploading) return;
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) handleFileSelect(selected);
    e.target.value = '';
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>문서 업로드</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          data-testid="drop-zone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={[
            'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors',
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 bg-muted/10',
            uploading ? 'opacity-60 pointer-events-none' : 'cursor-pointer',
          ].join(' ')}
        >
          {uploadedDocumentId ? (
            <div className="w-full space-y-2 text-green-600">
              <p className="text-sm font-medium">업로드 완료! ✓</p>
              <p className="text-xs break-words" data-testid="document-id">
                Document ID: {uploadedDocumentId}
              </p>
            </div>
          ) : file ? (
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span
                  data-testid="file-name"
                  className="text-sm font-medium truncate max-w-xs"
                >
                  {file.name}
                </span>
                <Badge variant="secondary" data-testid="file-size">
                  {formatFileSize(file.size)}
                </Badge>
              </div>
              {uploading && (
                <ProgressBar
                  value={progress}
                  label={`${progress}%`}
                />
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              파일을 여기로 드래그하거나 버튼을 클릭하세요
            </p>
          )}
        </div>

        <input
          id="upload-file-input"
          type="file"
          aria-label="파일 선택"
          className="hidden"
          disabled={uploading}
          onChange={handleInputChange}
        />

        <div className="mt-4">
          <Button
            onClick={handleButtonClick}
            disabled={uploading}
            className="w-full"
          >
            {uploading ? `업로드 중... ${progress}%` : '파일 선택'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
