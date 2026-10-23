import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

/**
 * In-app notifications and confirmation dialog — replaces window.alert/confirm,
 * which block the page and look out of place in the UI.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback((kind, message) => {
    const id = ++nextId.current;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500);
  }, [dismiss]);

  const confirm = useCallback((message, { confirmLabel = 'Confirm', danger = false } = {}) =>
    new Promise((resolve) => setConfirmState({ message, confirmLabel, danger, resolve })), []);

  const closeConfirm = (answer) => {
    confirmState?.resolve(answer);
    setConfirmState(null);
  };

  const api = useMemo(() => ({
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    confirm,
  }), [push, confirm]);

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2 w-[min(380px,calc(100vw-2.5rem))]">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur animate-slide-in ${
              t.kind === 'error'
                ? 'bg-red-950/90 border-red-900/70 text-red-100'
                : 'bg-zinc-900/95 border-zinc-700 text-zinc-100'
            }`}
          >
            {t.kind === 'error'
              ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
              : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />}
            <p className="text-sm leading-snug flex-1 whitespace-pre-line">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="text-zinc-500 hover:text-white" aria-label="Dismiss">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {confirmState && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => closeConfirm(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-zinc-800 bg-[#121212] p-6 shadow-2xl animate-fade-in">
            <p className="text-sm text-zinc-200 leading-relaxed">{confirmState.message}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => closeConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm text-zinc-300 border border-zinc-800 hover:bg-zinc-900"
              >
                Cancel
              </button>
              <button
                autoFocus
                onClick={() => closeConfirm(true)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  confirmState.danger ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-white text-black hover:bg-zinc-200'
                }`}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}
