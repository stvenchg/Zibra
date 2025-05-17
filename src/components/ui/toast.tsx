import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

const ToastContext = React.createContext<{
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
})

export type Toast = {
  id: string;
  title?: string;
  description?: string;
  type: "success" | "error" | "info" | "warning";
  duration?: number;
}

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { ...toast, id }])

    // Auto-dismiss after duration
    if (toast.duration !== Infinity) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, toast.duration || 5000)
    }
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

const ToastContainer = () => {
  const { toasts, removeToast } = useToast()

  return (
    <div className="fixed bottom-0 right-0 z-50 p-4 space-y-2 max-w-md w-full">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "p-4 rounded-md shadow-md flex items-start justify-between transition-all transform translate-y-0 opacity-100",
            "animate-in slide-in-from-right-full duration-300",
            toast.type === "success" && "bg-green-50 text-green-800 border-l-4 border-green-500 dark:bg-green-950/50 dark:text-green-200 dark:border-green-600",
            toast.type === "error" && "bg-red-50 text-red-800 border-l-4 border-red-500 dark:bg-red-950/50 dark:text-red-200 dark:border-red-600",
            toast.type === "warning" && "bg-yellow-50 text-yellow-800 border-l-4 border-yellow-500 dark:bg-yellow-950/50 dark:text-yellow-200 dark:border-yellow-600",
            toast.type === "info" && "bg-blue-50 text-blue-800 border-l-4 border-blue-500 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-600"
          )}
        >
          <div className="flex-1 mr-2">
            {toast.title && (
              <p className="font-semibold">{toast.title}</p>
            )}
            {toast.description && (
              <p className="text-sm opacity-90">{toast.description}</p>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
} 