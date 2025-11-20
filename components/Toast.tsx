import React, { ReactNode, useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { X, RotateCcw } from "lucide-react";

// --- Internal Button Component to replace external dependency ---
const ToastButton = ({ onClick, children, className, size = "normal" }: any) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onClick?.();
    }}
    className={clsx(
      "flex items-center justify-center rounded-md transition-colors font-medium",
      size === "small" ? "p-1" : "px-3 py-1.5 text-xs",
      className
    )}
  >
    {children}
  </button>
);

// --- Types ---
type ToastType = "message" | "success" | "warning" | "error";

type Toast = {
  id: number;
  text: string | ReactNode;
  measuredHeight?: number;
  timeout?: ReturnType<typeof setTimeout>;
  remaining?: number;
  start?: number;
  pause?: () => void;
  resume?: () => void;
  preserve?: boolean;
  action?: string;
  onAction?: () => void;
  onUndoAction?: () => void;
  type: ToastType;
};

let toastId = 0;

// --- Store ---
const toastStore = {
  toasts: [] as Toast[],
  listeners: new Set<() => void>(),

  add(
    text: string | ReactNode,
    type: ToastType,
    preserve?: boolean,
    action?: string,
    onAction?: () => void,
    onUndoAction?: () => void
  ) {
    const id = toastId++;

    const toast: Toast = {
      id,
      text,
      preserve,
      action,
      onAction,
      onUndoAction,
      type
    };

    if (!toast.preserve) {
      toast.remaining = 4000; // Increased slightly for better readability
      toast.start = Date.now();

      const close = () => {
        this.toasts = this.toasts.filter((t) => t.id !== id);
        this.notify();
      };

      toast.timeout = setTimeout(close, toast.remaining);

      toast.pause = () => {
        if (!toast.timeout) return;
        clearTimeout(toast.timeout);
        toast.timeout = undefined;
        toast.remaining! -= Date.now() - toast.start!;
      };

      toast.resume = () => {
        if (toast.timeout) return;
        toast.start = Date.now();
        toast.timeout = setTimeout(close, toast.remaining);
      };
    }

    this.toasts.push(toast);
    this.notify();
  },

  remove(id: number) {
    toastStore.toasts = toastStore.toasts.filter((t) => t.id !== id);
    toastStore.notify();
  },

  subscribe(listener: () => void) {
    toastStore.listeners.add(listener);
    return () => {
      toastStore.listeners.delete(listener);
    };
  },

  notify() {
    toastStore.listeners.forEach((fn) => fn());
  }
};

// --- Container Component ---
export const ToastContainer = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [shownIds, setShownIds] = useState<number[]>([]);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const measureRef = (toast: Toast) => (node: HTMLDivElement | null) => {
    if (node && toast.measuredHeight == null) {
      toast.measuredHeight = node.getBoundingClientRect().height;
      toastStore.notify();
    }
  };

  useEffect(() => {
    setToasts([...toastStore.toasts]);
    return toastStore.subscribe(() => {
      setToasts([...toastStore.toasts]);
    });
  }, []);

  useEffect(() => {
    const unseen = toasts.filter(t => !shownIds.includes(t.id)).map(t => t.id);
    if (unseen.length > 0) {
      requestAnimationFrame(() => {
        setShownIds(prev => [...prev, ...unseen]);
      });
    }
  }, [toasts]);

  const lastVisibleCount = 3;
  const lastVisibleStart = Math.max(0, toasts.length - lastVisibleCount);

  const getFinalTransform = (index: number, length: number) => {
    if (index === length - 1) {
      return "none";
    }
    const offset = length - 1 - index;
    let translateY = toasts[length - 1]?.measuredHeight || 60;
    
    for (let i = length - 1; i > index; i--) {
      if (isHovered) {
        translateY += (toasts[i - 1]?.measuredHeight || 60) + 10;
      } else {
        translateY += 15; // Reduced overlap stack distance
      }
    }
    const z = -offset;
    const scale = isHovered ? 1 : (1 - 0.05 * offset);
    // Using fixed bottom positioning, so we translate UP (negative Y)
    return `translate3d(0, -${translateY}px, ${z}px) scale(${scale})`;
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    toastStore.toasts.forEach((t) => t.pause?.());
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    toastStore.toasts.forEach((t) => t.resume?.());
  };

  // Only render if there are toasts to avoid layout shifts or empty divs capturing clicks
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] w-[380px] pointer-events-none flex flex-col justify-end items-end"
      style={{ height: '400px' }} // Safe area
    >
      <div
        className="relative w-full h-full pointer-events-auto"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {toasts.map((toast, index) => {
          const isVisible = index >= lastVisibleStart;
          const isTop = index === toasts.length - 1;

          return (
            <div
              key={toast.id}
              ref={measureRef(toast)}
              className={clsx(
                "absolute right-0 bottom-0 rounded-xl p-4 shadow-2xl border transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] flex items-center justify-between gap-4 backdrop-blur-md",
                {
                  message: "bg-gray-900/95 border-gray-800 text-gray-100",
                  success: "bg-gray-900/95 border-green-900/50 text-green-400 shadow-green-900/10",
                  warning: "bg-gray-900/95 border-yellow-900/50 text-yellow-400 shadow-yellow-900/10",
                  error: "bg-gray-900/95 border-red-900/50 text-red-400 shadow-red-900/10"
                }[toast.type],
                isVisible ? "opacity-100" : "opacity-0",
                index < lastVisibleStart && "pointer-events-none"
              )}
              style={{
                width: "100%",
                transform: shownIds.includes(toast.id)
                  ? getFinalTransform(index, toasts.length)
                  : "translate3d(0, 100%, 150px) scale(0.9)",
                zIndex: index
              }}
            >
               {/* Decoration Line */}
               <div className={clsx("absolute left-0 top-4 bottom-4 w-1 rounded-r-full", 
                 {
                   message: "bg-gray-700",
                   success: "bg-green-500",
                   warning: "bg-yellow-500",
                   error: "bg-red-500"
                 }[toast.type]
               )}></div>

              <div className="flex-1 pl-3 text-sm font-medium leading-tight">
                {toast.text}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {toast.onUndoAction && (
                  <ToastButton
                    size="small"
                    className="text-gray-400 hover:text-white hover:bg-gray-800"
                    onClick={() => {
                      toast.onUndoAction?.();
                      toastStore.remove(toast.id);
                    }}
                  >
                    <RotateCcw size={14} />
                  </ToastButton>
                )}
                
                {toast.action && (
                  <ToastButton
                    className="bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700"
                    onClick={() => {
                      toast.onAction?.();
                      toastStore.remove(toast.id);
                    }}
                  >
                    {toast.action}
                  </ToastButton>
                )}

                {!toast.action && (
                  <ToastButton
                    size="small"
                    className="text-gray-500 hover:text-white hover:bg-gray-800"
                    onClick={() => toastStore.remove(toast.id)}
                  >
                    <X size={16} />
                  </ToastButton>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- Hook ---
interface Message {
  text: string | ReactNode;
  preserve?: boolean;
  action?: string;
  onAction?: () => void;
  onUndoAction?: () => void;
}

export const useToasts = () => {
  return {
    message: useCallback(({ text, preserve, action, onAction, onUndoAction }: Message) => {
      toastStore.add(text, "message", preserve, action, onAction, onUndoAction);
    }, []),
    success: useCallback((text: string, options?: Partial<Message>) => {
      toastStore.add(text, "success", options?.preserve, options?.action, options?.onAction, options?.onUndoAction);
    }, []),
    warning: useCallback((text: string, options?: Partial<Message>) => {
      toastStore.add(text, "warning", options?.preserve, options?.action, options?.onAction, options?.onUndoAction);
    }, []),
    error: useCallback((text: string, options?: Partial<Message>) => {
      toastStore.add(text, "error", options?.preserve, options?.action, options?.onAction, options?.onUndoAction);
    }, [])
  };
};