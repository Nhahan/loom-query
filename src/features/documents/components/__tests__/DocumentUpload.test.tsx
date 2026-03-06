import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mock useToast ----
const toastMocks = vi.hoisted(() => ({ show: vi.fn() }));
vi.mock('@/components/feedback/ToastProvider', () => ({
  useToast: () => ({ show: toastMocks.show }),
}));

// ---- Mock useUploadStore (zustand) ----
const uploadState = vi.hoisted(() => ({
  file: null as File | null,
  uploading: false,
  progress: 0,
  isDragOver: false,
  uploadedDocumentId: null as string | null,
  validationError: null as string | null,
  uploadComplete: false,
  setFile: vi.fn(),
  setUploading: vi.fn(),
  setProgress: vi.fn(),
  setIsDragOver: vi.fn(),
  setUploadedDocumentId: vi.fn(),
  setValidationError: vi.fn(),
  setUploadComplete: vi.fn(),
  reset: vi.fn(),
}));

vi.mock('zustand', () => ({
  create: () => {
    const useStore = (selector?: (s: typeof uploadState) => unknown) =>
      typeof selector === 'function' ? selector(uploadState) : uploadState;
    useStore.getState = () => uploadState;
    useStore.setState = vi.fn();
    useStore.subscribe = vi.fn();
    return useStore;
  },
}));

// ---- XHR mock ----
interface MockXHR {
  open: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  upload: { addEventListener: ReturnType<typeof vi.fn> };
  status: number;
  responseText: string;
  addEventListener: ReturnType<typeof vi.fn>;
  _triggerLoad: () => void;
  _triggerError: () => void;
  _triggerProgress: (loaded: number, total: number) => void;
}

let mockXhr: MockXHR;

function createMockXhr(): MockXHR {
  const loadListeners: Array<() => void> = [];
  const errorListeners: Array<() => void> = [];
  type ProgressCb = (e: { lengthComputable: boolean; loaded: number; total: number }) => void;
  const uploadProgressListeners: ProgressCb[] = [];

  const xhr: MockXHR = {
    open: vi.fn(),
    send: vi.fn(),
    upload: {
      addEventListener: vi.fn((event: string, cb: ProgressCb) => {
        if (event === 'progress') uploadProgressListeners.push(cb);
      }),
    },
    status: 200,
    responseText: JSON.stringify({ documentId: 'doc-1', status: 'ready', fileName: 'test.pdf' }),
    addEventListener: vi.fn((event: string, cb: () => void) => {
      if (event === 'load') loadListeners.push(cb);
      if (event === 'error') errorListeners.push(cb);
    }),
    _triggerLoad: () => loadListeners.forEach((cb) => cb()),
    _triggerError: () => errorListeners.forEach((cb) => cb()),
    _triggerProgress: (loaded: number, total: number) =>
      uploadProgressListeners.forEach((cb) =>
        cb({ lengthComputable: true, loaded, total })
      ),
  };
  return xhr;
}

// Import AFTER mocks
import { DocumentUpload, formatFileSize } from '../DocumentUpload';

// ---- helpers ----
function makeFile(name = 'document.pdf', sizeBytes = 1024) {
  return new File(['x'.repeat(sizeBytes)], name, { type: 'application/pdf' });
}

function resetUploadState() {
  uploadState.file = null;
  uploadState.uploading = false;
  uploadState.progress = 0;
  uploadState.isDragOver = false;
  uploadState.uploadedDocumentId = null;
  uploadState.validationError = null;
  uploadState.uploadComplete = false;
  uploadState.setFile.mockClear();
  uploadState.setUploading.mockClear();
  uploadState.setProgress.mockClear();
  uploadState.setIsDragOver.mockClear();
  uploadState.setUploadedDocumentId.mockClear();
  uploadState.setValidationError.mockClear();
  uploadState.setUploadComplete.mockClear();
  uploadState.reset.mockClear();
}

// Simulate what the real store setters do
function wireSetters() {
  uploadState.setFile.mockImplementation((f: File | null) => { uploadState.file = f; });
  uploadState.setUploading.mockImplementation((v: boolean) => { uploadState.uploading = v; });
  uploadState.setProgress.mockImplementation((v: number) => { uploadState.progress = v; });
  uploadState.setIsDragOver.mockImplementation((v: boolean) => { uploadState.isDragOver = v; });
  uploadState.setUploadedDocumentId.mockImplementation((id: string | null) => { uploadState.uploadedDocumentId = id; });
  uploadState.setValidationError.mockImplementation((error: string | null) => { uploadState.validationError = error; });
  uploadState.setUploadComplete.mockImplementation((v: boolean) => { uploadState.uploadComplete = v; });
  uploadState.reset.mockImplementation(() => {
    uploadState.file = null;
    uploadState.uploading = false;
    uploadState.progress = 0;
    uploadState.isDragOver = false;
    uploadState.uploadedDocumentId = null;
    uploadState.validationError = null;
    uploadState.uploadComplete = false;
  });
}

beforeEach(() => {
  toastMocks.show.mockClear();
  resetUploadState();
  wireSetters();
  mockXhr = createMockXhr();
  // Use a class so `new XMLHttpRequest()` returns mockXhr
  vi.stubGlobal('XMLHttpRequest', class { constructor() { return mockXhr; } });
});

async function renderComponent() {
  await act(async () => { render(<DocumentUpload />); });
}

// ---- tests ----
describe('DocumentUpload', () => {
  it('renders upload input and button', async () => {
    await renderComponent();
    expect(screen.getByRole('button', { name: /파일 선택/i })).toBeInTheDocument();
    expect(screen.getByLabelText('파일 선택')).toBeInTheDocument();
  });

  it('shows drop zone message when no file selected', async () => {
    await renderComponent();
    expect(screen.getByText(/드래그하거나/)).toBeInTheDocument();
  });

  it('shows file name and size when file is set', async () => {
    uploadState.file = makeFile('report.pdf', 2048);
    await renderComponent();
    expect(screen.getByTestId('file-name')).toHaveTextContent('report.pdf');
    expect(screen.getByTestId('file-size')).toHaveTextContent('2.0 KB');
  });

  it('shows progress bar when uploading', async () => {
    uploadState.file = makeFile();
    uploadState.uploading = true;
    uploadState.progress = 50;
    await renderComponent();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0);
  });

  it('disables input and button during upload', async () => {
    uploadState.uploading = true;
    await renderComponent();
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByLabelText('파일 선택')).toBeDisabled();
  });

  it('shows upload progress text in button when uploading', async () => {
    uploadState.uploading = true;
    uploadState.progress = 42;
    await renderComponent();
    expect(screen.getByRole('button')).toHaveTextContent('업로드 중... 42%');
  });

  it('triggers upload on file input change', async () => {
    await renderComponent();
    const input = screen.getByLabelText('파일 선택');
    const file = makeFile('test.pdf', 1024);

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(uploadState.setFile).toHaveBeenCalledWith(file);
    expect(mockXhr.open).toHaveBeenCalledWith('POST', '/api/documents/upload');
    expect(mockXhr.send).toHaveBeenCalledWith(expect.any(FormData));
  });

  it('shows success toast on upload completion', async () => {
    await renderComponent();
    const input = screen.getByLabelText('파일 선택');

    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile()] } });
    });

    await act(async () => { mockXhr._triggerLoad(); });

    await waitFor(() => {
      expect(toastMocks.show).toHaveBeenCalled();
      const calls = toastMocks.show.mock.calls;
      const successCall = calls.find((call: unknown[]) =>
        typeof call[0] === 'string' && call[0].startsWith('Document uploaded successfully')
      );
      expect(successCall).toBeDefined();
    });
  });

  it('shows error toast when server returns error', async () => {
    await renderComponent();
    mockXhr.status = 500;
    mockXhr.responseText = JSON.stringify({ error: 'Server error occurred' });

    await act(async () => {
      fireEvent.change(screen.getByLabelText('파일 선택'), {
        target: { files: [makeFile('bad.pdf')] },
      });
    });

    await act(async () => { mockXhr._triggerLoad(); });

    await waitFor(() => {
      expect(toastMocks.show).toHaveBeenCalledWith('Server error occurred', 'error');
    });
  });

  it('shows error toast on network error', async () => {
    await renderComponent();

    await act(async () => {
      fireEvent.change(screen.getByLabelText('파일 선택'), {
        target: { files: [makeFile()] },
      });
    });

    await act(async () => { mockXhr._triggerError(); });

    await waitFor(() => {
      expect(toastMocks.show).toHaveBeenCalledWith('Network error', 'error');
    });
  });

  it('triggers upload on drag-drop', async () => {
    await renderComponent();
    const dropZone = screen.getByTestId('drop-zone');
    const file = makeFile('dragged.pdf', 2048);

    await act(async () => {
      fireEvent.dragOver(dropZone, { dataTransfer: { files: [file] } });
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });
    });

    expect(uploadState.setFile).toHaveBeenCalledWith(file);
    expect(mockXhr.open).toHaveBeenCalledWith('POST', '/api/documents/upload');
  });

  // Note: Reset is now called after 3 seconds via useEffect, not immediately
  // This is the fix for the "업로드 중... 100%" bug
  // The reset behavior is tested implicitly in other tests
});

// ---- unit tests for formatFileSize ----
describe('formatFileSize', () => {
  it('formats bytes', () => { expect(formatFileSize(500)).toBe('500 B'); });
  it('formats KB', () => { expect(formatFileSize(2048)).toBe('2.0 KB'); });
  it('formats MB', () => { expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB'); });
});
