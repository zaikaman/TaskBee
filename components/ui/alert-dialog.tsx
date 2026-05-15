"use client";

import * as React from "react";

type AlertDialogContextType = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const AlertDialogContext = React.createContext<AlertDialogContextType | undefined>(undefined);

const useAlertDialog = () => {
  const context = React.useContext(AlertDialogContext);
  if (!context) {
    throw new Error("useAlertDialog must be used within AlertDialog");
  }
  return context;
};

const AlertDialog = ({
  children,
  open,
  onOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange! : setInternalOpen;

  return (
    <AlertDialogContext.Provider value={{ open: isOpen, onOpenChange: setIsOpen }}>
      {children}
    </AlertDialogContext.Provider>
  );
};

const AlertDialogTrigger = ({
  children,
  asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) => {
  const { onOpenChange } = useAlertDialog();

  if (asChild) {
    return <div onClick={() => onOpenChange(true)}>{children}</div>;
  }

  return (
    <button onClick={() => onOpenChange(true)} type="button">
      {children}
    </button>
  );
};

const AlertDialogContent = ({ children }: { children: React.ReactNode }) => {
  const { open, onOpenChange } = useAlertDialog();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />

      {/* Content */}
      <div className="relative z-50 w-full max-w-lg rounded-lg border border-[#d3dae6] bg-white p-6 shadow-lg">
        {children}
      </div>
    </div>
  );
};

const AlertDialogHeader = ({ children }: { children: React.ReactNode }) => {
  return <div className="mb-4 space-y-2">{children}</div>;
};

const AlertDialogTitle = ({ children }: { children: React.ReactNode }) => {
  return <h2 className="text-lg font-semibold text-[#203259]">{children}</h2>;
};

const AlertDialogDescription = ({ children }: { children: React.ReactNode }) => {
  return <p className="text-sm text-[#7f8aa0]">{children}</p>;
};

const AlertDialogFooter = ({ children }: { children: React.ReactNode }) => {
  return <div className="mt-6 flex justify-end gap-3">{children}</div>;
};

const AlertDialogCancel = ({
  children,
  disabled,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) => {
  const { onOpenChange } = useAlertDialog();

  return (
    <button
      className="h-10 rounded border border-[#d3dae6] bg-white px-4 text-sm font-medium text-[#203259] hover:bg-[#f5f7fa] disabled:opacity-50"
      disabled={disabled}
      onClick={() => onOpenChange(false)}
      type="button"
    >
      {children}
    </button>
  );
};

const AlertDialogAction = ({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) => {
  const { onOpenChange } = useAlertDialog();

  const handleClick = () => {
    onClick?.();
    if (!disabled) {
      onOpenChange(false);
    }
  };

  return (
    <button
      className={`h-10 rounded bg-[#22ab59] px-4 text-sm font-medium text-white hover:bg-[#1a8a47] disabled:opacity-50 ${className}`}
      disabled={disabled}
      onClick={handleClick}
      type="button"
    >
      {children}
    </button>
  );
};

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
};
