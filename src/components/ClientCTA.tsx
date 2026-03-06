'use client';

interface ClientCTAProps {
  label: string;
  onClick: () => void;
}

export function ClientCTA({ label, onClick }: ClientCTAProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
    >
      {label}
    </button>
  );
}
