import React from "react";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

export const Toaster = ({ theme = "system", ...props }: ToasterProps) => {
  const bg = "#2f302f";
  const border = "#3a3c3a";
  const text = "#f4f4f4";
  const muted = "#cfcfcf";
  const actionBg = "#e38664";
  const actionHover = "#c96e50";
  const cancelBg = "#3a3c3a";
  const cancelHover = "#303230";
  const cancelText = "#e1e1e1";

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        style: {
          background: bg,
          color: text,
          border: `1px solid ${border}`,
        },
        className: "shadow-2xl",
        classNames: {
          toast:
            "group toast bg-transparent text-inherit border-transparent shadow-none",
          description: "",
        },
        cancelButtonStyle: {
          background: cancelBg,
          color: cancelText,
          border: `1px solid ${border}`,
        },
        actionButtonStyle: {
          background: actionBg,
          color: "#1f1f1f",
          border: `1px solid ${border}`,
        },
      }}
      {...props}
    />
  );
};

export const ToastContainer = Toaster;

interface Message {
  text: string;
  description?: string;
  preserve?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

export const useToasts = () => {
  return {
    message: ({ text, description, preserve, actionLabel, onAction }: Message) =>
      toast(text, {
        description,
        duration: preserve ? Infinity : 3000,
        action: actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined,
      }),
    success: (text: string, description?: string) => toast.success(text, { description }),
    warning: (text: string, description?: string) => toast.warning(text, { description }),
    error: (text: string, description?: string) => toast.error(text, { description }),
    promise: <T>(p: Promise<T>, opts: { loading: string; success: string; error: string }) =>
      toast.promise(p, opts),
  };
};
