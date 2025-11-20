import { Toast, Toaster, createToaster } from "@ark-ui/react/toast";
import { Portal } from "@ark-ui/react/portal";
import { X } from "lucide-react";
import { useCallback } from "react";

export const toaster = createToaster({
  placement: "bottom-end",
  gap: 16,
  overlap: true,
  duration: 3000,
});

export const ToastContainer = () => {
  return (
    <Portal>
      <Toaster toaster={toaster}>
        {(toast) => (
          <Toast.Root className="bg-gray-900/80 backdrop-blur-xl rounded-xl shadow-2xl border border-gray-700 min-w-[420px] p-4 relative overflow-anywhere transition-all duration-300 ease-default will-change-transform h-(--height) opacity-(--opacity) translate-x-(--x) translate-y-(--y) scale-(--scale) z-(--z-index)">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                {toast.title && (
                  <Toast.Title className="text-gray-100 font-semibold text-sm">
                    {toast.title}
                  </Toast.Title>
                )}
                {toast.description && (
                  <Toast.Description className="text-gray-300 text-sm mt-1">
                    {toast.description}
                  </Toast.Description>
                )}
              </div>
              <Toast.CloseTrigger className="p-1 hover:bg-gray-800 rounded transition-colors text-gray-400 hover:text-gray-300 flex-shrink-0">
                <X className="w-4 h-4" />
              </Toast.CloseTrigger>
            </div>
          </Toast.Root>
        )}
      </Toaster>
    </Portal>
  );
};

interface Message {
  text: string;
  preserve?: boolean;
  action?: string;
  onAction?: () => void;
  onUndoAction?: () => void;
}

export const useToasts = () => {
  return {
    message: useCallback(({ text, preserve }: Message) => {
      toaster.create({
        title: text,
        type: "info",
        duration: preserve ? Infinity : 3000,
      });
    }, []),
    success: useCallback((text: string) => {
      toaster.create({
        title: text,
        type: "success",
        duration: 3000,
      });
    }, []),
    warning: useCallback((text: string) => {
      toaster.create({
        title: text,
        type: "warning",
        duration: 3000,
      });
    }, []),
    error: useCallback((text: string) => {
      toaster.create({
        title: text,
        type: "error",
        duration: 3000,
      });
    }, [])
  };
};
