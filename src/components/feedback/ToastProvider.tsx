'use client';

import { create } from 'zustand';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import type { ReactNode } from 'react';

export type ToastSeverity = 'info' | 'warning' | 'error';

export interface Toast {
  id: string;
  message: string;
  severity: ToastSeverity;
}

interface ToastStore {
  toasts: Toast[];
  show: (message: string, severity?: ToastSeverity) => void;
  dismiss: (id: string) => void;
}

const AUTO_DISMISS_MS = 5000;
let _counter = 0;
const _timers = new Map<string, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (message: string, severity: ToastSeverity = 'info') => {
    const id = `toast-${++_counter}`;
    set((state) => ({ toasts: [...state.toasts, { id, message, severity }] }));
    const timer = setTimeout(() => {
      _timers.delete(id);
      set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
    }, AUTO_DISMISS_MS);
    _timers.set(id, timer);
  },
  dismiss: (id: string) => {
    const timer = _timers.get(id);
    if (timer) {
      clearTimeout(timer);
      _timers.delete(id);
    }
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));

export function useToast() {
  const show = useToastStore((state) => state.show);
  return { show };
}

const SEVERITY_STYLES: Record<ToastSeverity, string> = {
  info: 'bg-blue-50 border-blue-200 text-blue-900',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
  error: 'bg-red-50 border-red-200 text-red-900',
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'flex items-start gap-3 rounded-md border px-4 py-3 shadow-sm',
        SEVERITY_STYLES[toast.severity]
      )}
    >
      <span className="flex-1 text-sm">{toast.message}</span>
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <>
      {children}
      <div
        aria-label="notifications"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </>
  );
}
