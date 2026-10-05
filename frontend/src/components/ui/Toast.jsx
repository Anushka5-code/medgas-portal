import { X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

const CONFIGS = {
  success: { bg: 'bg-green-50 border-green-200',  text: 'text-green-800',  Icon: CheckCircle,  iconCls: 'text-green-500'  },
  warning: { bg: 'bg-amber-50 border-amber-200',  text: 'text-amber-800',  Icon: AlertTriangle, iconCls: 'text-amber-500' },
  danger:  { bg: 'bg-red-50   border-red-200',    text: 'text-red-800',    Icon: XCircle,       iconCls: 'text-red-500'   },
  info:    { bg: 'bg-blue-50  border-blue-200',   text: 'text-blue-800',   Icon: Info,          iconCls: 'text-blue-500'  },
};

function ToastItem({ toast, onDismiss }) {
  const cfg = CONFIGS[toast.type] || CONFIGS.info;
  const { Icon } = cfg;
  return (
    <div
      role="alert"
      aria-live="polite"
      className={`toast-in flex items-start gap-3 px-4 py-3 rounded-xl border shadow-hover max-w-sm w-full ${cfg.bg}`}
    >
      <Icon size={18} className={`mt-0.5 shrink-0 ${cfg.iconCls}`} />
      <p className={`flex-1 text-sm font-medium leading-snug ${cfg.text}`}>{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
      >
        <X size={15} />
      </button>
    </div>
  );
}

/** Fixed bottom-right toast stack. Pass the toasts array and dismissToast fn. */
export function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
