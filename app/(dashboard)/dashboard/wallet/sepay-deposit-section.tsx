"use client";

import { useState, type ChangeEvent } from "react";
import { formatVnd } from "@/lib/utils/money";

type SePayDepositSectionProps = {
  quickDepositAmounts: string[];
};

export function SePayDepositSection({ quickDepositAmounts }: SePayDepositSectionProps) {
  const [amount, setAmount] = useState("");
  const formattedAmount = amount ? formatVnd(amount) : "";

  function handleAmountChange(event: ChangeEvent<HTMLInputElement>) {
    setAmount(event.target.value.replace(/[^\d]/g, ""));
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_220px]">
      <div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {quickDepositAmounts.map((quickAmount) => {
            const isSelected = amount === quickAmount;

            return (
              <button
                className={
                  isSelected
                    ? "h-10 bg-[#e8f7ef] text-sm font-bold text-[#007d3e] ring-1 ring-inset ring-[#00a650]"
                    : "h-10 bg-[#f5f7fa] text-sm font-bold text-[#00a650]"
                }
                key={quickAmount}
                onClick={() => setAmount(quickAmount)}
                type="button"
              >
                {formatVnd(quickAmount)}
              </button>
            );
          })}
        </div>
        <div className="mt-6">
          <label className="mb-2 block text-sm font-bold" htmlFor="sepay-custom-amount">
            Số tiền tùy chỉnh
          </label>
          <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
            <input
              className="h-10 bg-[#f5f7fa] px-4 text-right text-sm font-semibold tabular-nums text-[#001b49] outline-none placeholder:text-[#94a0b8]"
              id="sepay-custom-amount"
              inputMode="numeric"
              onChange={handleAmountChange}
              placeholder="0 ₫"
              type="text"
              value={formattedAmount}
            />
            <button className="bg-[#a9a9a9] text-sm font-bold uppercase text-white" disabled type="button">
              Tạo lệnh nạp
            </button>
          </div>
        </div>
        <div className="mt-4 bg-[#fff3cf] p-4 text-sm text-[#996500]">
          Lệnh nạp SePay sẽ dùng mã chuyển khoản riêng cho từng giao dịch để hệ thống tự đối soát và cộng số dư.
        </div>
      </div>

      <div className="bg-[#f5f7fa] p-5 text-sm leading-6 text-[#001b49]">
        <p className="font-bold">Quy trình tự động</p>
        <ol className="mt-3 space-y-2">
          <li>1. Tạo lệnh nạp với mã chuyển khoản riêng.</li>
          <li>2. Chuyển đúng nội dung qua ngân hàng.</li>
          <li>3. SePay xác nhận và ví được cộng tự động.</li>
        </ol>
      </div>
    </div>
  );
}
