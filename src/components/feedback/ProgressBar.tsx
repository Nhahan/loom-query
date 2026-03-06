import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  currentStep?: number;
  totalSteps?: number;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  currentStep,
  totalSteps,
  className,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const hasStepInfo = currentStep !== undefined && totalSteps !== undefined;

  return (
    <div className={cn('w-full space-y-1.5', className)}>
      <div className="flex items-center justify-between text-sm">
        {label && <span className="text-muted-foreground">{label}</span>}
        <div className="flex items-center gap-2 ml-auto">
          {hasStepInfo && (
            <span className="text-muted-foreground text-xs">
              {currentStep}/{totalSteps}
            </span>
          )}
          <span className="font-medium tabular-nums">{Math.round(percentage)}%</span>
        </div>
      </div>
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-300 ease-in-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
