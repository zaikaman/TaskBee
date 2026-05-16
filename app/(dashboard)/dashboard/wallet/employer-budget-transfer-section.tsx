"use client";

import { useActionState, useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { formatVnd } from "@/lib/utils/money";
import {
  transferWorkerFundsAction,
  type TransferWorkerFundsActionState,
} from "./actions";

type EmployerBudgetTransferSectionProps = {
  employerAvailableBalance: string;
  workerAvailableBalance: string;
};

const initialState: TransferWorkerFundsActionState = { ok: false };

export function EmployerBudgetTransferSection({
  employerAvailableBalance,
  workerAvailableBalance,
}: EmployerBudgetTransferSectionProps) {
  const [amount, setAmount] = useState("");
  const [state, formAction, isPending] = useActionState(transferWorkerFundsAction, initialState);
  const router = useRouter();
  const displayEmployerBalance = state.employerAvailableBalance ?? employerAvailableBalance;
  const displayWorkerBalance = state.workerAvailableBalance ?? workerAvailableBalance;

  useEffect(() => {
    if (state.ok) {
      setAmount("");
      router.refresh();
    }
  }, [router, state.ok]);

  function handleAmountChange(event: ChangeEvent<HTMLInputElement>) {
    setAmount(event.target.value.replace(/[^\d]/g, ""));
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <div className="bg-[#f5f7fa] p-4">
          <p className="text-sm font-medium text-[#686d77]">Ngân sách employer</p>
          <p className="mt-1 text-xl font-black text-[#00a650]">
            {formatVnd(displayEmployerBalance)}
          </p>
        </div>
        <div className="bg-[#f5f7fa] p-4">
          <p className="text-sm font-medium text-[#686d77]">Thu nhập freelancer có thể chuyển</p>
          <p className="mt-1 text-xl font-black text-[#00a650]">
            {formatVnd(displayWorkerBalance)}
          </p>
        </div>
      </div>

      <form action={formAction} className="grid gap-3">
        <input name="amount" type="hidden" value={amount} />
        <label className="text-sm font-bold" htmlFor="worker-to-employer-transfer">
          Chuyển thu nhập freelancer sang ngân sách employer
        </label>
        <div className="grid gap-3 sm:grid-cols-[1fr_150px] lg:grid-cols-1 xl:grid-cols-[1fr_150px]">
          <input
            className="h-10 bg-[#f5f7fa] px-4 text-right text-sm font-semibold tabular-nums text-[#001b49] outline-none placeholder:text-[#94a0b8]"
            id="worker-to-employer-transfer"
            inputMode="numeric"
            onChange={handleAmountChange}
            placeholder="0 đ"
            type="text"
            value={amount ? formatVnd(amount) : ""}
          />
          <button
            className="bg-[#22ab59] text-sm font-bold uppercase text-white transition-colors hover:bg-[#005924] disabled:bg-[#a9a9a9]"
            disabled={isPending || !amount}
            type="submit"
          >
            {isPending ? "Đang chuyển..." : "Chuyển"}
          </button>
        </div>
      </form>

      {state.error ? (
        <p className="bg-[#fce3e5] p-3 text-sm font-medium text-[#8a1218]">{state.error}</p>
      ) : null}
      {state.ok && state.message ? (
        <p className="bg-[#e8f7ef] p-3 text-sm font-medium text-[#007d3e]">{state.message}</p>
      ) : null}

      <p className="bg-[#fff3cf] p-4 text-sm leading-6 text-[#996500]">
        Khoản đã chuyển sang ngân sách employer chỉ dùng để đăng việc và không thể rút lại ở ví worker.
      </p>
    </div>
  );
}
