"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";

type ToastVariant = "default" | "success" | "error";

interface ToastContextValue {
  toast: (title: string, description?: string, variant?: ToastVariant) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [variant, setVariant] = React.useState<ToastVariant>("default");

  const toast = React.useCallback(
    (nextTitle: string, nextDescription?: string, nextVariant: ToastVariant = "default") => {
      setTitle(nextTitle);
      setDescription(nextDescription ?? "");
      setVariant(nextVariant);
      setOpen(true);
    },
    []
  );

  const variantClasses: Record<ToastVariant, string> = {
    default: "",
    success: "border-emerald-500/60",
    error: "border-destructive/60",
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-[420px]" />
        <ToastPrimitive.Root
          open={open}
          onOpenChange={setOpen}
          className={`pointer-events-auto relative flex w-full items-center justify-between gap-2 rounded-md border bg-background p-4 shadow-lg ${variantClasses[variant]}`}
        >
          <div className="grid gap-1">
            <ToastPrimitive.Title className="text-sm font-semibold">{title}</ToastPrimitive.Title>
            {description ? (
              <ToastPrimitive.Description className="text-sm text-muted-foreground">
                {description}
              </ToastPrimitive.Description>
            ) : null}
          </div>
          <ToastPrimitive.Close className="rounded-sm opacity-70 transition-opacity hover:opacity-100">
            <X className="h-4 w-4" />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export { useToast };
