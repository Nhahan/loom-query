export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
export const MAX_CONCURRENT_JOBS = 3;
export const DEFAULT_CHUNK_SIZE = 512;
export const SUPPORTED_FORMATS = [
  '.pdf',
  '.docx',
  '.xlsx',
  '.html',
  '.txt',
  '.md',
  '.hwp',
  '.hwpx',
] as const;
