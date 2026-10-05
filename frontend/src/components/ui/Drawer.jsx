import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Right-side slide-over drawer.
 * Props: open, onClose, title, children, width (default "w-[480px]")
 */
export function Drawer({ open, onClose, title, children, width = 'w-[480px]' }) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-navy/20 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div className={`drawer-in relative z-10 ${width} max-w-full h-full bg-white shadow-2xl flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-navy">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-muted"
          >
            <X size={18} />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
