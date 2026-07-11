// App-wide toast system. Extracted verbatim from App.jsx (H9) so pages don't
// have to import the monolith for a toast hook. RouterApp hoists a single
// ToastProvider above the whole router (covering routes like /my-decks that
// don't mount AppInner).
import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext({ addToast: () => {} });

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = "info", timeout = 3000) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, timeout);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed right-4 bottom-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-3 py-2 rounded-xl shadow-lg text-sm ${
              t.type === "error"
                ? "bg-red-900/80 text-red-100 border border-red-700"
                : t.type === "success"
                ? "bg-emerald-900/80 text-emerald-100 border border-emerald-700"
                : "bg-gray-800/80 text-gray-100 border border-white/10"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function useToasts() {
  return useContext(ToastContext);
}

export { ToastProvider, useToasts };
