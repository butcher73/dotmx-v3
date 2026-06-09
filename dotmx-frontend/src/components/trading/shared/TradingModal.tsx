"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalBackdropProps {
  children: React.ReactNode;
  onClick: () => void;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
}

interface ModalHeaderProps {
  title?: string | undefined;
  subtitle?: string | undefined;
  icon?: React.ReactNode;
  onClose: () => void;
}

interface ModalContentProps {
  children: React.ReactNode;
  className?: string;
}

// Portal component for rendering modals at the root level
function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(children, document.body);
}

// Modal backdrop with click-to-close functionality
export const ModalBackdrop = React.memo<ModalBackdropProps>(
  ({ children, onClick }) => {
    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClick();
        }
      };

      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }, [onClick]);

    return (
      <Portal>
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-all duration-200"
            onClick={onClick}
            aria-hidden="true"
          />
          <div className="animate-in zoom-in-95 fade-in relative z-10 w-full max-w-md duration-200">
            {children}
          </div>
        </div>
      </Portal>
    );
  }
);

ModalBackdrop.displayName = "ModalBackdrop";

// Modal header component
function ModalHeader({ title, subtitle, icon, onClose }: ModalHeaderProps) {
  return (
    <div className="border-border flex items-center justify-between border-b p-6">
      <div className="flex items-center space-x-3">
        {icon && (
          <div className="bg-negative/20 ring-negative/30 flex h-8 w-8 items-center justify-center rounded-lg ring-1">
            {icon}
          </div>
        )}
        <div>
          {title && (
            <h3 className="text-foreground text-lg font-semibold">{title}</h3>
          )}
          {subtitle && (
            <p className="text-foreground-muted text-sm">{subtitle}</p>
          )}
        </div>
      </div>
      <button
        onClick={onClose}
        className="text-foreground-muted hover:bg-background-hover hover:text-foreground rounded-lg p-2 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// Modal content wrapper
function ModalContent({ children, className = "" }: ModalContentProps) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}

// Main modal component
export function TradingModal({
  isOpen,
  onClose,
  children,
  title,
  subtitle,
  icon,
  className = "",
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <ModalBackdrop onClick={onClose}>
      <div
        className={`border-border bg-background-card rounded-lg border ${className}`}
      >
        {(title || subtitle || icon) && (
          <ModalHeader
            title={title}
            subtitle={subtitle}
            icon={icon}
            onClose={onClose}
          />
        )}
        <ModalContent>{children}</ModalContent>
      </div>
    </ModalBackdrop>
  );
}

// Utility hook for outside click detection
export function useOutsideClick(callback: () => void) {
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [callback]);

  return ref;
}
