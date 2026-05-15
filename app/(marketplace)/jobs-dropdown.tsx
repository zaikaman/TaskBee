"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface JobsDropdownProps {
  isActive?: boolean;
}

const menuButtonClassName =
  "w-full px-4 py-3 text-left text-sm hover:bg-slate-50";

export function JobsDropdown({ isActive = true }: JobsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`inline-flex items-center gap-1 rounded-t px-4 py-2 text-sm transition-colors ${
          isActive
            ? "border-b-2 border-emerald-600 font-semibold text-emerald-700"
            : "font-medium text-slate-500 hover:text-emerald-700"
        }`}
      >
        Việc làm nhỏ
        <ChevronDown
          className={`size-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-0 w-64 rounded-b border border-slate-200 bg-white shadow-lg">
          <div className="py-2">
            <button
              type="button"
              className={menuButtonClassName}
              onClick={() => {
                setIsOpen(false);
              }}
            >
              <div className="font-medium text-slate-900">Tìm việc làm</div>
            </button>

            <div className="my-1 h-px bg-slate-100" />

            <button
              type="button"
              className={menuButtonClassName}
              onClick={() => {
                setIsOpen(false);
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">Nhiệm vụ đã hoàn thành</span>
                <span className="text-slate-500">0</span>
              </div>
            </button>

            <button
              type="button"
              className={menuButtonClassName}
              onClick={() => {
                setIsOpen(false);
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">Đã xác nhận + thanh toán</span>
                <span className="text-slate-500">0</span>
              </div>
            </button>

            <button
              type="button"
              className={menuButtonClassName}
              onClick={() => {
                setIsOpen(false);
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">Đang chờ xét duyệt</span>
                <span className="text-slate-500">0</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
