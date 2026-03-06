export enum ErrorCode {
  PARSE_FAILED = 'PARSE_FAILED',
  PARSE_UNSUPPORTED = 'PARSE_UNSUPPORTED',
  INGEST_FAILED = 'INGEST_FAILED',
  SEARCH_FAILED = 'SEARCH_FAILED',
  LLM_TIMEOUT = 'LLM_TIMEOUT',
  STORAGE_FULL = 'STORAGE_FULL',
  RATE_LIMITED = 'RATE_LIMITED',
  AUTH_INVALID = 'AUTH_INVALID',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly recovery?: string;
  readonly traceId?: string;

  constructor(opts: {
    code: ErrorCode;
    message: string;
    recovery?: string;
    traceId?: string;
  }) {
    super(opts.message);
    this.name = 'AppError';
    this.code = opts.code;
    this.recovery = opts.recovery;
    this.traceId = opts.traceId;
  }
}
