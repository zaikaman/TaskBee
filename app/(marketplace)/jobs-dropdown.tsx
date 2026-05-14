"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface JobsDropdownProps {
  isActive?: boolean;
}

export function JobsDropdown({ isActive = true }: JobsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log("JobsDropdown mounted");
  }, []);

  useEffect(() => {
    console.log("Dropdown state changed:", isOpen);
    
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
    console.log("Toggle clicked, current state:", isOpen, "event:", e.type);
    setIsOpen((prev) => {
      console.log("Setting isOpen from", prev, "to", !prev);
      return !prev;
    });
  };

  return (
    <div className="relative" ref={dropdownRef} style={{ pointerEvents: 'auto' }}>
      <button
        type="button"
        onMouseDown={handleToggle}
        onClickCapture={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log("Click capture triggered");
        }}
        className={`inline-flex items-center gap-1 rounded-b-none rounded-t px-4 py-2 text-sm font-medium transition-colors ${
          isActive
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "bg-transparent text-slate-500 hover:bg-slate-100"
        }`}
      >
        Việc làm nhỏ
        <ChevronDown
          className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-0 w-64 rounded-b border border-slate-200 bg-white shadow-lg">
          <div className="py-2">
            <button
              className="w-full px-4 py-3 text-left text-sm hover:bg-slate-50"
              onClick={() => {
                setIsOpen(false);
                console.log("Tìm việc làm clicked");
              }}
            >
              <div className="font-medium text-slate-900">Tìm việc làm</div>
            </button>

            <button
              className="w-full px-4 py-3 text-left text-sm hover:bg-slate-50"
              onClick={() => {
                setIsOpen(false);
                console.log("Nhiệm vụ đã hoàn thành clicked");
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">Nhiệm vụ đã hoàn thành</span>
                <span className="text-slate-500">0</span>
              </div>
            </button>

            <button
              className="w-full px-4 py-3 text-left text-sm hover:bg-slate-50"
              onClick={() => {
                setIsOpen(false);
                console.log("Đã xác nhận + thanh toán clicked");
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">Đã xác nhận + thanh toán</span>
                <span className="text-slate-500">0</span>
              </div>
            </button>

            <button
              className="w-full px-4 py-3 text-left text-sm hover:bg-slate-50"
              onClick={() => {
                setIsOpen(false);
                console.log("Đang chờ xét duyệt clicked");
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
