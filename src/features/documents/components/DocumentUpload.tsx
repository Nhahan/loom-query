'use client';

import { useEffect } from 'react';
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
  uploadComplete: boolean;
  setFile: (file: File | null) => void;
  setUploading: (uploading: boolean) => void;
  setProgress: (progress: number) => void;
  setIsDragOver: (isDragOver: boolean) => void;
  setUploadedDocumentId: (id: string | null) => void;
  setValidationError: (error: string | null) => void;
  setUploadComplete: (complete: boolean) => void;
  reset: () => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  file: null,
  uploading: false,
  progress: 0,
  isDragOver: false,
  uploadedDocumentId: null,
  validationError: null,
  uploadComplete: false,
  setFile: (file) => set({ file }),
  setUploading: (uploading) => set({ uploading }),
  setProgress: (progress) => set({ progress }),
  setIsDragOver: (isDragOver) => set({ isDragOver }),
  setUploadedDocumentId: (uploadedDocumentId) => set({ uploadedDocumentId }),
  setValidationError: (validationError) => set({ validationError }),
  setUploadComplete: (uploadComplete) => set({ uploadComplete }),
  reset: () => set({
    file: null,
    uploading: false,
    progress: 0,
    isDragOver: false,
    uploadedDocumentId: null,
    validationError: null,
    uploadComplete: false,
  }),
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
    return 'PDF와 TXT 파일만 업로드 가능합니다';
  }
  if (file.size > MAX_FILE_SIZE) {
    return '파일 크기가 50 MB를 초과합니다';
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
  const uploadComplete = useUploadStore((s) => s.uploadComplete);
  const setFile = useUploadStore((s) => s.setFile);
  const setUploading = useUploadStore((s) => s.setUploading);
  const setProgress = useUploadStore((s) => s.setProgress);
  const setIsDragOver = useUploadStore((s) => s.setIsDragOver);
  const setUploadedDocumentId = useUploadStore((s) => s.setUploadedDocumentId);
  const setValidationError = useUploadStore((s) => s.setValidationError);
  const setUploadComplete = useUploadStore((s) => s.setUploadComplete);
  const reset = useUploadStore((s) => s.reset);
  const { show } = useToast();

  // Auto-reset after 3 seconds
  useEffect(() => {
    if (uploadComplete) {
      const timer = setTimeout(() => {
        reset();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [uploadComplete, reset]);

  function handleButtonClick() {
    const input = document.getElementById('upload-file-input') as HTMLInputElement | null;
    input?.click();
  }

  async function uploadFile(selectedFile: File) {
    setUploading(true);
    setProgress(0);
    setUploadComplete(false);

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
              reject(new Error('응답 형식이 올바르지 않습니다'));
            }
          } else {
            let message = '업로드에 실패했습니다';
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
          reject(new Error('네트워크 오류가 발생했습니다'));
        });

        xhr.open('POST', '/api/documents/upload');
        xhr.send(formData);
      });

      // Success: show completion state
      setProgress(100);
      setUploading(false);
      setUploadedDocumentId(data.documentId);
      setUploadComplete(true);
      show(`문서 업로드 완료! (ID: ${data.documentId})`, 'info');
    } catch (err) {
      const message = err instanceof Error ? err.message : '업로드에 실패했습니다';
      show(message, 'error');
      setUploading(false);
      setProgress(0);
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

  // Determine button state
  let buttonText = '파일 선택';
  let buttonDisabled = uploading || uploadComplete;

  if (uploading) {
    buttonText = `업로드 중... ${progress}%`;
  } else if (uploadComplete) {
    buttonText = '업로드 완료 ✓';
  } else if (file) {
    buttonText = '업로드 시작';
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
          {uploadComplete && uploadedDocumentId ? (
            <div className="w-full space-y-2 text-green-600">
              <p className="text-sm font-medium">✓ 업로드 완료!</p>
              <p className="text-xs break-words font-mono text-green-700" data-testid="document-id">
                ID: {uploadedDocumentId}
              </p>
              <p className="text-xs text-gray-500 mt-2">3초 후 자동으로 초기화됩니다</p>
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
          accept=".pdf,.txt"
        />

        <div className="mt-4">
          <Button
            onClick={handleButtonClick}
            disabled={buttonDisabled}
            className="w-full"
            data-testid="upload-button"
          >
            {buttonText}
          </Button>
        </div>

        {validationError && (
          <p className="mt-2 text-sm text-red-600" data-testid="error-message">
            ⚠️ {validationError}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
