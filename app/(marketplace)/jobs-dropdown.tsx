"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

interface JobsDropdownProps {
  isActive?: boolean;
}

const menuButtonClassName =
  "block w-full px-4 py-3 text-left text-sm hover:bg-[#f5f7fa]";

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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`inline-flex h-10 items-center gap-2 rounded-t px-4 text-base transition-colors ${
          isActive
            ? "bg-[#22ab59] font-semibold text-white"
            : "font-semibold text-[#687282] hover:bg-[#f5f7fa] hover:text-[#22ab59]"
        }`}
      >
        Việc nhỏ
        <ChevronDown className={`size-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-full z-50 w-72 border border-[#edf0f4] bg-white shadow-[0_12px_28px_rgba(20,28,38,0.13)]">
          <div className="py-2">
            <Link href="/marketplace" className={menuButtonClassName} onClick={() => setIsOpen(false)}>
              <span className="font-semibold text-[#203259]">Tìm việc nhỏ</span>
            </Link>

            <div className="my-1 h-px bg-[#edf0f4]" />

            <Link href="/marketplace/finished" className={menuButtonClassName} onClick={() => setIsOpen(false)}>
              <span className="flex items-center justify-between">
                <span className="font-semibold text-[#203259]">Việc đã hoàn thành</span>
                <span className="text-[#687282]">0</span>
              </span>
            </Link>

            <Link href="/marketplace/paid" className={menuButtonClassName} onClick={() => setIsOpen(false)}>
              <span className="flex items-center justify-between">
                <span className="font-semibold text-[#203259]">Đã duyệt và thanh toán</span>
                <span className="text-[#687282]">0</span>
              </span>
            </Link>

            <Link href="/marketplace/pending" className={menuButtonClassName} onClick={() => setIsOpen(false)}>
              <span className="flex items-center justify-between">
                <span className="font-semibold text-[#203259]">Đang chờ duyệt</span>
                <span className="text-[#687282]">0</span>
              </span>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
