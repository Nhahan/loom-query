import { AppError } from '@/lib/errors';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface ErrorDisplayProps {
  error: AppError;
  className?: string;
}

export function ErrorDisplay({ error, className }: ErrorDisplayProps) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-lg border border-red-200 bg-white shadow-sm overflow-hidden',
        className
      )}
    >
      <div className="bg-red-50 px-4 py-3 border-b border-red-200">
        <h3 className="text-sm font-semibold text-red-800">
          {t('error.title')}
        </h3>
        <p className="mt-0.5 text-xs text-red-600">
          {t('error.code')}: <span className="font-mono font-medium">{error.code}</span>
        </p>
      </div>
      <div className="px-4 py-3 space-y-2">
        <p className="text-sm text-gray-800">{error.message}</p>
        {error.recovery && (
          <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2">
            <p className="text-xs font-medium text-blue-700">{t('error.recovery')}</p>
            <p className="mt-0.5 text-xs text-blue-600">{error.recovery}</p>
          </div>
        )}
        {error.traceId && (
          <p className="text-xs text-gray-400 font-mono">ID: {error.traceId}</p>
        )}
      </div>
    </div>
  );
}
