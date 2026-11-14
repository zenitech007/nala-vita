"use client";

import { useId, ReactNode } from "react";
import AccessibleDialog from "@/components/ui/AccessibleDialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: keyof typeof sizeClasses;
}

export default function Modal({ isOpen, onClose, title, children, size = "md" }: ModalProps) {
  const titleId = useId();
  return (
    <AccessibleDialog isOpen={isOpen} onClose={onClose} labelledBy={titleId}
        className={cn(
          "relative z-10 max-h-[calc(100dvh-2rem)] overflow-y-auto w-full rounded-xl bg-white p-6 shadow-xl",
          sizeClasses[size]
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id={titleId} className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
    </AccessibleDialog>
  );
}
