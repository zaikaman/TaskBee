"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Clock3,
  Copy,
  Landmark,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  TimerReset,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAYMENT_CONFIG } from "@/config/app";
import {
  DepositIntentStatus,
  DepositNetwork,
  DepositProvider,
} from "@/lib/generated/prisma/browser";
import { formatVnd } from "@/lib/utils/money";
import type { DepositIntentDetails, WalletBalance } from "@/lib/services/wallet";
import {
  createDepositAction,
  refreshDepositIntentAction,
  type CreateDepositActionState,
} from "./actions";

type DepositPageClientProps = {
  balance: WalletBalance | null;
  initialDepositIntent: DepositIntentDetails | null;
  recentDepositIntents: DepositIntentDetails[];
  refreshIntervalSeconds: number;
};

type DepositMethod = "SEPAY" | "USDT";

const quickDepositAmounts = ["100000", "250000", "500000", "1000000", "2000000", "5000000"];
const initialState: CreateDepositActionState = { ok: false };
const refreshableStatuses = new Set<DepositIntentStatus>([
  DepositIntentStatus.PENDING,
  DepositIntentStatus.CONFIRMING,
]);

function formatDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRemainingTime(expiresAt: Date | string) {
  const remainingMs = new Date(expiresAt).getTime() - Date.now();

  if (remainingMs <= 0) {
    return "Đã hết hạn";
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function normalizeNumericAmount(value: string) {
  return value.replace(/[^\d]/g, "");
}

function getStatusLabel(status: DepositIntentStatus) {
  const labels: Record<DepositIntentStatus, string> = {
    PENDING: "Đang chờ thanh toán",
    CONFIRMING: "Đang xác nhận",
    PAID: "Đã cộng ví",
    EXPIRED: "Đã hết hạn",
    CANCELLED: "Đã hủy",
    FAILED: "Thất bại",
    UNDERPAID: "Thanh toán thiếu",
    OVERPAID: "Thanh toán thừa",
    MANUAL_REVIEW_REQUIRED: "Cần kiểm tra thủ công",
  };

  return labels[status];
}

function getStatusClassName(status: DepositIntentStatus) {
  if (status === DepositIntentStatus.PAID) {
    return "border-[#b8e8ca] bg-[#e8f7ef] text-[#007d3e]";
  }

  if (status === DepositIntentStatus.PENDING || status === DepositIntentStatus.CONFIRMING) {
    return "border-[#ffe4a3] bg-[#fff3cf] text-[#996500]";
  }

  return "border-[#f4b8bd] bg-[#fce3e5] text-[#8a1218]";
}

function resolveNetworkName(network: DepositNetwork | null) {
  return PAYMENT_CONFIG.usdt.networks.find((item) => item.code === network)?.name ?? network;
}

function getExpectedUsdtAmount(intent: DepositIntentDetails | null) {
  const snapshot = intent?.exchangeRateSnapshot;

  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  const amount = (snapshot as { expectedUsdtAmount?: unknown }).expectedUsdtAmount;

  return typeof amount === "string" ? amount : null;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <Button className="h-8 rounded-none" onClick={copyValue} size="sm" type="button" variant="outline">
      <Copy className="size-3.5" aria-hidden="true" />
      {copied ? "Đã sao chép" : label}
    </Button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#f5f7fa] px-4 py-3">
      <p className="text-xs font-bold uppercase text-[#686d77]">{label}</p>
      <p className="mt-1 text-base font-black text-[#001b49]">{value}</p>
    </div>
  );
}

function PaymentTabs({
  activeMethod,
  onChange,
}: {
  activeMethod: DepositMethod;
  onChange: (method: DepositMethod) => void;
}) {
  const tabs = [
    { key: "SEPAY" as const, label: "SePay", icon: Landmark },
    { key: "USDT" as const, label: "USDT", icon: WalletCards },
  ];

  return (
    <div className="grid grid-cols-2 border border-[#d3dae6] bg-[#f5f7fa] p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const selected = activeMethod === tab.key;

        return (
          <button
            className={
              selected
                ? "flex h-11 items-center justify-center gap-2 bg-white text-sm font-black uppercase text-[#001b49] shadow-sm"
                : "flex h-11 items-center justify-center gap-2 text-sm font-bold uppercase text-[#686d77] hover:text-[#001b49]"
            }
            key={tab.key}
            onClick={() => onChange(tab.key)}
            type="button"
          >
            <Icon className="size-4" aria-hidden="true" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function DepositForm({
  activeMethod,
  amount,
  network,
  isPending,
  onAmountChange,
  onNetworkChange,
  formAction,
}: {
  activeMethod: DepositMethod;
  amount: string;
  network: DepositNetwork;
  isPending: boolean;
  onAmountChange: (value: string) => void;
  onNetworkChange: (value: DepositNetwork) => void;
  formAction: (formData: FormData) => void;
}) {
  const minimumAmount =
    activeMethod === "SEPAY"
      ? PAYMENT_CONFIG.sepay.minimumDepositVnd
      : PAYMENT_CONFIG.usdt.minimumDepositVnd;
  const maximumAmount =
    activeMethod === "SEPAY"
      ? PAYMENT_CONFIG.sepay.maximumDepositVnd
      : PAYMENT_CONFIG.usdt.maximumDepositVnd;

  return (
    <form action={formAction} className="space-y-6">
      <input name="provider" type="hidden" value={activeMethod} />
      <input name="currency" type="hidden" value="VND" />
      <input name="amount" type="hidden" value={amount} />
      {activeMethod === "USDT" ? <input name="usdtNetwork" type="hidden" value={network} /> : null}

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <label className="text-sm font-black uppercase text-[#001b49]" htmlFor="deposit-amount">
            Số tiền muốn nạp
          </label>
          <span className="text-xs font-bold text-[#686d77]">
            {formatVnd(minimumAmount)} - {formatVnd(maximumAmount)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {quickDepositAmounts.map((quickAmount) => {
            const selected = amount === quickAmount;

            return (
              <button
                className={
                  selected
                    ? "h-10 bg-[#e8f7ef] text-sm font-black text-[#007d3e] ring-1 ring-inset ring-[#00a650]"
                    : "h-10 bg-[#f5f7fa] text-sm font-bold text-[#00a650] hover:bg-[#e8f7ef]"
                }
                key={quickAmount}
                onClick={() => onAmountChange(quickAmount)}
                type="button"
              >
                {formatVnd(quickAmount)}
              </button>
            );
          })}
        </div>

        <Input
          className="mt-3 h-12 rounded-none border-[#d3dae6] bg-white text-right text-lg font-black tabular-nums text-[#001b49] focus-visible:border-[#22ab59] focus-visible:ring-[#22ab59]/20"
          id="deposit-amount"
          inputMode="numeric"
          onChange={(event) => onAmountChange(normalizeNumericAmount(event.target.value))}
          placeholder="Nhập số tiền VND"
          value={amount ? formatVnd(amount) : ""}
        />
      </div>

      {activeMethod === "USDT" ? (
        <div>
          <label className="mb-3 block text-sm font-black uppercase text-[#001b49]" htmlFor="usdt-network">
            Mạng USDT
          </label>
          <select
            className="h-12 w-full border border-[#d3dae6] bg-white px-4 text-sm font-bold text-[#001b49] outline-none transition-colors focus:border-[#22ab59] focus:ring-2 focus:ring-[#22ab59]/20"
            id="usdt-network"
            onChange={(event) => onNetworkChange(event.target.value as DepositNetwork)}
            value={network}
          >
            {PAYMENT_CONFIG.usdt.networks
              .filter((item) => item.enabled)
              .map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name} - {item.requiredConfirmations} confirmations
                </option>
              ))}
          </select>
        </div>
      ) : null}

      <Button
        className="h-12 w-full rounded-none bg-[#22ab59] text-sm font-black uppercase text-white hover:bg-[#005924]"
        disabled={isPending || !amount}
        type="submit"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        Tạo lệnh nạp
      </Button>
    </form>
  );
}

function SePayInstruction({ intent }: { intent: DepositIntentDetails }) {
  const instructions = intent.sepayTransferInstructions;

  if (!instructions) {
    return null;
  }

  const qrUrl = `https://img.vietqr.io/image/${encodeURIComponent(
    instructions.bankShortName,
  )}-${encodeURIComponent(instructions.accountNumber)}-compact2.png?amount=${encodeURIComponent(
    instructions.amount,
  )}&addInfo=${encodeURIComponent(instructions.transferContent)}&accountName=${encodeURIComponent(
    instructions.accountName,
  )}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="bg-[#f5f7fa] p-4">
        <img alt="QR chuyển khoản SePay" className="aspect-square w-full bg-white object-contain" src={qrUrl} />
      </div>
      <div className="grid gap-3">
        <Metric label="Ngân hàng" value={`${instructions.bankShortName} - ${instructions.bankName}`} />
        <Metric label="Số tài khoản" value={instructions.accountNumber} />
        <Metric label="Chủ tài khoản" value={instructions.accountName} />
        <Metric label="Số tiền" value={formatVnd(instructions.amount)} />
        <div className="bg-[#001b49] p-4 text-white">
          <p className="text-xs font-bold uppercase text-white/70">Nội dung chuyển khoản bắt buộc</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <code className="text-lg font-black tracking-wide">{instructions.transferContent}</code>
            <CopyButton label="Sao chép" value={instructions.transferContent} />
          </div>
        </div>
      </div>
    </div>
  );
}

function UsdtInstruction({ intent }: { intent: DepositIntentDetails }) {
  if (!intent.destinationAddress || !intent.network) {
    return null;
  }

  const expectedUsdtAmount = getExpectedUsdtAmount(intent);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    intent.destinationAddress,
  )}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="bg-[#f5f7fa] p-4">
        <img alt="QR địa chỉ ví USDT" className="aspect-square w-full bg-white object-contain p-3" src={qrUrl} />
      </div>
      <div className="grid gap-3">
        <Metric label="Mạng" value={resolveNetworkName(intent.network) ?? intent.network} />
        <Metric label="Số tiền ghi nhận vào ví" value={formatVnd(intent.amount)} />
        {expectedUsdtAmount ? <Metric label="Số USDT kỳ vọng" value={`${expectedUsdtAmount} USDT`} /> : null}
        <Metric
          label="Số xác nhận yêu cầu"
          value={`${intent.confirmations}/${intent.requiredConfirmations} confirmations`}
        />
        <div className="bg-[#001b49] p-4 text-white">
          <p className="text-xs font-bold uppercase text-white/70">Địa chỉ ví nhận USDT</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <code className="max-w-full break-all text-sm font-black">{intent.destinationAddress}</code>
            <CopyButton label="Sao chép ví" value={intent.destinationAddress} />
          </div>
        </div>
        <div className="bg-[#fff3cf] p-4 text-sm font-medium leading-6 text-[#996500]">
          Chỉ gửi đúng USDT trên mạng {resolveNetworkName(intent.network)}. Gửi sai mạng hoặc sai tài sản sẽ cần
          kiểm tra thủ công và có thể không khôi phục được.
        </div>
      </div>
    </div>
  );
}

function DepositIntentPanel({
  intent,
  isRefreshing,
  onRefresh,
}: {
  intent: DepositIntentDetails | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const [remainingTime, setRemainingTime] = useState(intent ? formatRemainingTime(intent.expiresAt) : "");

  useEffect(() => {
    if (!intent || !refreshableStatuses.has(intent.status)) {
      return;
    }

    setRemainingTime(formatRemainingTime(intent.expiresAt));
    const timer = window.setInterval(() => {
      setRemainingTime(formatRemainingTime(intent.expiresAt));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [intent]);

  if (!intent) {
    return (
      <section className="border border-dashed border-[#d3dae6] bg-[#f5f7fa] p-8 text-center text-[#001b49]">
        <QrCode className="mx-auto size-10 text-[#22ab59]" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-black">Chưa có lệnh nạp đang hiển thị</h2>
        <p className="mt-2 text-sm text-[#686d77]">
          Chọn phương thức, nhập số tiền và tạo lệnh nạp để nhận QR cùng mã thanh toán riêng.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
      <header className="flex flex-col gap-4 border-b border-[#e5eaf1] bg-[#f5f7fa] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black text-[#001b49]">Lệnh nạp {intent.paymentCode}</h2>
            <Badge className={getStatusClassName(intent.status)} variant="outline">
              {getStatusLabel(intent.status)}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-[#686d77]">
            Tạo lúc {formatDateTime(intent.createdAt)} · Hết hạn lúc {formatDateTime(intent.expiresAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 items-center gap-2 bg-white px-3 text-sm font-black text-[#001b49]">
            <TimerReset className="size-4 text-[#22ab59]" aria-hidden="true" />
            {refreshableStatuses.has(intent.status) ? remainingTime : getStatusLabel(intent.status)}
          </div>
          <Button className="h-9 rounded-none" onClick={onRefresh} type="button" variant="outline">
            {isRefreshing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            Cập nhật
          </Button>
        </div>
      </header>
      <div className="p-5">
        {intent.provider === DepositProvider.SEPAY ? (
          <SePayInstruction intent={intent} />
        ) : (
          <UsdtInstruction intent={intent} />
        )}
      </div>
    </section>
  );
}

function RecentDeposits({ deposits }: { deposits: DepositIntentDetails[] }) {
  return (
    <section className="bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
      <h2 className="text-base font-black text-[#001b49]">Lệnh nạp gần đây</h2>
      <div className="mt-4 grid gap-3">
        {deposits.length === 0 ? (
          <p className="bg-[#f5f7fa] p-4 text-sm text-[#686d77]">Chưa có lệnh nạp nào.</p>
        ) : (
          deposits.map((deposit) => (
            <div className="grid gap-2 border border-[#e5eaf1] p-3" key={deposit.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-sm font-black text-[#001b49]">{deposit.paymentCode}</p>
                <Badge className={getStatusClassName(deposit.status)} variant="outline">
                  {getStatusLabel(deposit.status)}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#686d77]">
                <span>{deposit.provider === DepositProvider.SEPAY ? "SePay" : `USDT ${deposit.network}`}</span>
                <span className="font-bold text-[#00a650]">{formatVnd(deposit.amount)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export function DepositPageClient({
  balance,
  initialDepositIntent,
  recentDepositIntents,
  refreshIntervalSeconds,
}: DepositPageClientProps) {
  const [activeMethod, setActiveMethod] = useState<DepositMethod>(
    initialDepositIntent?.provider === DepositProvider.USDT ? "USDT" : "SEPAY",
  );
  const [amount, setAmount] = useState("500000");
  const [network, setNetwork] = useState<DepositNetwork>(DepositNetwork.TRC20);
  const [currentIntent, setCurrentIntent] = useState<DepositIntentDetails | null>(initialDepositIntent);
  const [state, formAction, isPending] = useActionState(createDepositAction, initialState);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const hasRefreshableIntent = currentIntent ? refreshableStatuses.has(currentIntent.status) : false;

  useEffect(() => {
    if (state.ok && state.depositIntent) {
      setCurrentIntent(state.depositIntent);
      setActiveMethod(state.depositIntent.provider === DepositProvider.USDT ? "USDT" : "SEPAY");
    }
  }, [state]);

  const refreshCurrentIntent = useMemo(
    () => () => {
      if (!currentIntent) {
        return;
      }

      startRefreshTransition(async () => {
        const refreshedIntent = await refreshDepositIntentAction(currentIntent.id);

        if (refreshedIntent) {
          setCurrentIntent(refreshedIntent);
        }
      });
    },
    [currentIntent],
  );

  useEffect(() => {
    if (!hasRefreshableIntent || !currentIntent) {
      return;
    }

    const timer = window.setInterval(refreshCurrentIntent, refreshIntervalSeconds * 1000);

    return () => window.clearInterval(timer);
  }, [currentIntent, hasRefreshableIntent, refreshCurrentIntent, refreshIntervalSeconds]);

  return (
    <main className="mx-auto max-w-[1120px] pb-16 pt-6 text-[#001b49]">
      <section className="grid gap-4 border-b border-[#d3dae6] pb-7 lg:grid-cols-[1fr_340px] lg:items-end">
        <div>
          <p className="text-xs font-black uppercase text-[#22ab59]">Ví nhà tuyển dụng</p>
          <h1 className="mt-2 text-3xl font-black tracking-normal text-[#001b49]">Nạp tiền</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#686d77]">
            Tạo lệnh nạp riêng cho từng giao dịch. Hệ thống chỉ cộng số dư sau khi provider xác nhận và ledger được ghi
            trong một giao dịch an toàn.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm lg:grid-cols-1">
          <Metric label="Khả dụng" value={formatVnd(balance?.availableBalance ?? "0")} />
          <Metric label="Đang chờ" value={formatVnd(balance?.pendingBalance ?? "0")} />
          <Metric label="Ký quỹ" value={formatVnd(balance?.escrowBalance ?? "0")} />
        </div>
      </section>

      <div className="mt-7 grid gap-6 lg:grid-cols-[420px_1fr]">
        <section className="bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
          <PaymentTabs activeMethod={activeMethod} onChange={setActiveMethod} />
          <div className="mt-6">
            <DepositForm
              activeMethod={activeMethod}
              amount={amount}
              formAction={formAction}
              isPending={isPending}
              network={network}
              onAmountChange={setAmount}
              onNetworkChange={setNetwork}
            />
          </div>

          {state.error ? (
            <div className="mt-5 flex gap-3 bg-[#fce3e5] p-4 text-sm font-medium leading-6 text-[#8a1218]">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>{state.error}</p>
            </div>
          ) : null}

          {state.ok && state.message ? (
            <div className="mt-5 flex gap-3 bg-[#e8f7ef] p-4 text-sm font-medium leading-6 text-[#007d3e]">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>{state.message}</p>
            </div>
          ) : null}

          <div className="mt-6 grid gap-3 text-sm leading-6 text-[#001b49]">
            <div className="flex gap-3 bg-[#f5f7fa] p-4">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#22ab59]" aria-hidden="true" />
              <p>Không gửi lại giao dịch cũ. Mỗi lệnh nạp có mã riêng và tự hết hạn để tránh đối soát nhầm.</p>
            </div>
            <div className="flex gap-3 bg-[#fff3cf] p-4 text-[#996500]">
              <Clock3 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <p>Giữ nguyên số tiền, nội dung chuyển khoản và mạng USDT như hướng dẫn trên màn hình.</p>
            </div>
          </div>
        </section>

        <div className="grid gap-6">
          <DepositIntentPanel
            intent={currentIntent}
            isRefreshing={isRefreshing}
            onRefresh={refreshCurrentIntent}
          />
          <RecentDeposits deposits={recentDepositIntents} />
        </div>
      </div>

      <section className="mt-6 grid gap-3 text-sm md:grid-cols-3">
        <div className="bg-[#f5f7fa] p-4">
          <Banknote className="size-5 text-[#22ab59]" aria-hidden="true" />
          <p className="mt-3 font-black text-[#001b49]">SePay</p>
          <p className="mt-1 leading-6 text-[#686d77]">Chuyển khoản đúng mã, hệ thống tự nhận webhook ngân hàng.</p>
        </div>
        <div className="bg-[#f5f7fa] p-4">
          <WalletCards className="size-5 text-[#22ab59]" aria-hidden="true" />
          <p className="mt-3 font-black text-[#001b49]">USDT</p>
          <p className="mt-1 leading-6 text-[#686d77]">Snapshot tỷ giá được lưu khi tạo lệnh để đối soát on-chain.</p>
        </div>
        <div className="bg-[#f5f7fa] p-4">
          <ShieldCheck className="size-5 text-[#22ab59]" aria-hidden="true" />
          <p className="mt-3 font-black text-[#001b49]">Ledger</p>
          <p className="mt-1 leading-6 text-[#686d77]">Số dư chỉ được cộng khi provider xác nhận và ledger đã ghi.</p>
        </div>
      </section>
    </main>
  );
}
