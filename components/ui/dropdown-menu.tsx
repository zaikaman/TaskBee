"use client";

import * as React from "react";

type DropdownContextType = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
};

const DropdownContext = React.createContext<DropdownContextType | undefined>(undefined);

const useDropdown = () => {
  const context = React.useContext(DropdownContext);
  if (!context) {
    throw new Error("Dropdown components must be used within DropdownMenu");
  }
  return context;
};

const DropdownMenu = ({
  children,
  onOpenChange,
}: {
  children: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      setIsOpen(open);
      onOpenChange?.(open);
    },
    [onOpenChange],
  );

  return (
    <DropdownContext.Provider value={{ isOpen, setIsOpen: handleOpenChange }}>
      <div className="relative">{children}</div>
    </DropdownContext.Provider>
  );
};

const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ children, asChild, onClick, ...props }, ref) => {
  const { isOpen, setIsOpen } = useDropdown();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
    onClick?.(e);
  };

  const handleDivClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  if (asChild) {
    return <div onClick={handleDivClick}>{children}</div>;
  }

  return (
    <button ref={ref} onClick={handleClick} type="button" {...props}>
      {children}
    </button>
  );
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

const DropdownMenuContent = ({
  children,
  align = "start",
  className = "",
}: {
  children: React.ReactNode;
  align?: "start" | "end";
  className?: string;
}) => {
  const { isOpen, setIsOpen } = useDropdown();
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
        const target = event.target as HTMLElement;
        // Check if click is on trigger button
        if (!target.closest('[role="trigger"]')) {
          setIsOpen(false);
        }
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    // Use setTimeout to avoid immediate closing
    setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }, 0);
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, setIsOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={contentRef}
      className={`absolute z-[9999] mt-2 min-w-[200px] overflow-hidden rounded-lg border border-[#f0f2f5] bg-white shadow-xl ${
        align === "end" ? "right-0" : "left-0"
      } ${className}`}
      style={{ top: "100%" }}
    >
      <div className="p-1 flex flex-col gap-0.5">
        {children}
      </div>
    </div>
  );
};

const DropdownMenuItem = ({
  children,
  onClick,
  disabled,
  className = "",
  asChild,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  asChild?: boolean;
}) => {
  const { setIsOpen } = useDropdown();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      onClick?.();
      setIsOpen(false);
    }
  };

  const itemClassName = `relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-[#686d77] transition-all hover:bg-[#f5f7fa] hover:text-[#1b1b1b] disabled:pointer-events-none disabled:opacity-50 ${className}`;

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string; onClick?: (e: React.MouseEvent) => void }>;
    return React.cloneElement(child, {
      onClick: (e: React.MouseEvent) => {
        handleClick(e);
        if (child.props.onClick) {
          child.props.onClick(e);
        }
      },
      className: `${itemClassName} ${child.props.className || ""}`,
    });
  }

  return (
    <button
      className={itemClassName}
      disabled={disabled}
      onClick={handleClick}
      type="button"
    >
      {children}
    </button>
  );
};

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
