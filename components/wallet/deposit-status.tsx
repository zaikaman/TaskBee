import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  HelpCircle,
  Loader2,
  RefreshCw,
  ShieldAlert,
  TimerOff,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DepositConfirmationStatus,
  DepositIntentStatus,
} from "@/lib/generated/prisma/browser";

export type DepositStatusTone = "warning" | "success" | "danger" | "neutral";

export type DepositStatusDefinition = {
  label: string;
  title: string;
  description: string;
  tone: DepositStatusTone;
  icon: typeof Clock3;
};

export const depositStatusDefinitions = {
  PENDING: {
    label: "Đang chờ thanh toán",
    title: "Lệnh nạp đang chờ thanh toán",
    description: "Hãy chuyển đúng số tiền, đúng nội dung và đúng mạng để hệ thống đối soát tự động.",
    tone: "warning",
    icon: Clock3,
  },
  CONFIRMING: {
    label: "Đang xác nhận",
    title: "Provider đã ghi nhận giao dịch",
    description: "Khoản nạp đang chờ đủ xác nhận trước khi cộng vào số dư khả dụng.",
    tone: "warning",
    icon: Loader2,
  },
  PAID: {
    label: "Đã cộng ví",
    title: "Khoản nạp đã hoàn tất",
    description: "Số tiền đã được cộng vào ví và ledger đã ghi nhận giao dịch.",
    tone: "success",
    icon: CheckCircle2,
  },
  EXPIRED: {
    label: "Đã hết hạn",
    title: "Lệnh nạp đã hết hạn",
    description: "Không tiếp tục thanh toán lệnh này. Hãy tạo lệnh mới để tránh đối soát nhầm.",
    tone: "neutral",
    icon: TimerOff,
  },
  CANCELLED: {
    label: "Đã hủy",
    title: "Lệnh nạp đã bị hủy",
    description: "Lệnh này không còn hiệu lực và không làm thay đổi số dư ví.",
    tone: "neutral",
    icon: XCircle,
  },
  FAILED: {
    label: "Thất bại",
    title: "Provider báo giao dịch thất bại",
    description: "Khoản nạp không được cộng tự động. Kiểm tra lại provider hoặc tạo lệnh mới.",
    tone: "danger",
    icon: AlertCircle,
  },
  UNDERPAID: {
    label: "Thanh toán thiếu",
    title: "Số tiền nhận được thấp hơn lệnh nạp",
    description: "Khoản nạp đang chờ admin kiểm tra. Hệ thống không cộng ví tự động với giao dịch thiếu tiền.",
    tone: "danger",
    icon: ShieldAlert,
  },
  OVERPAID: {
    label: "Thanh toán thừa",
    title: "Số tiền nhận được cao hơn lệnh nạp",
    description: "Khoản nạp đang chờ admin kiểm tra để xử lý phần chênh lệch an toàn.",
    tone: "danger",
    icon: ShieldAlert,
  },
  MANUAL_REVIEW_REQUIRED: {
    label: "Cần kiểm tra thủ công",
    title: "Lệnh nạp cần admin kiểm tra",
    description: "Provider gửi dữ liệu không khớp hoàn toàn với lệnh nạp nên hệ thống tạm dừng cộng ví.",
    tone: "danger",
    icon: HelpCircle,
  },
} satisfies Record<DepositIntentStatus, DepositStatusDefinition>;

const toneClassNames: Record<DepositStatusTone, { badge: string; callout: string; icon: string }> = {
  warning: {
    badge: "border-[#ffe4a3] bg-[#fff3cf] text-[#996500]",
    callout: "border-[#ffe4a3] bg-[#fff3cf] text-[#996500]",
    icon: "text-[#996500]",
  },
  success: {
    badge: "border-[#b8e8ca] bg-[#e8f7ef] text-[#007d3e]",
    callout: "border-[#b8e8ca] bg-[#e8f7ef] text-[#007d3e]",
    icon: "text-[#007d3e]",
  },
  danger: {
    badge: "border-[#f4b8bd] bg-[#fce3e5] text-[#8a1218]",
    callout: "border-[#f4b8bd] bg-[#fce3e5] text-[#8a1218]",
    icon: "text-[#8a1218]",
  },
  neutral: {
    badge: "border-[#d3dae6] bg-[#f5f7fa] text-[#001b49]",
    callout: "border-[#d3dae6] bg-[#f5f7fa] text-[#001b49]",
    icon: "text-[#686d77]",
  },
};

export function getDepositStatusLabel(status: DepositIntentStatus) {
  return depositStatusDefinitions[status].label;
}

export function getDepositStatusTone(status: DepositIntentStatus) {
  return depositStatusDefinitions[status].tone;
}

export function isDepositStatusRefreshable(status: DepositIntentStatus) {
  return status === DepositIntentStatus.PENDING || status === DepositIntentStatus.CONFIRMING;
}

export function DepositStatusBadge({
  status,
  className,
}: {
  status: DepositIntentStatus;
  className?: string;
}) {
  const definition = depositStatusDefinitions[status];

  return (
    <Badge className={cn(toneClassNames[definition.tone].badge, className)} variant="outline">
      {definition.label}
    </Badge>
  );
}

export function DepositStatusCallout({
  status,
  className,
  children,
}: {
  status: DepositIntentStatus;
  className?: string;
  children?: React.ReactNode;
}) {
  const definition = depositStatusDefinitions[status];
  const Icon = definition.icon;

  return (
    <div className={cn("flex gap-3 border p-4 text-sm leading-6", toneClassNames[definition.tone].callout, className)}>
      <Icon
        className={cn("mt-0.5 size-5 shrink-0", toneClassNames[definition.tone].icon, {
          "animate-spin": status === DepositIntentStatus.CONFIRMING,
        })}
        aria-hidden="true"
      />
      <div>
        <p className="font-black">{definition.title}</p>
        <p className="mt-1 font-medium">{children ?? definition.description}</p>
      </div>
    </div>
  );
}

export function DepositStatusTimeline({
  status,
  confirmationStatus,
  confirmations,
  requiredConfirmations,
  className,
}: {
  status: DepositIntentStatus;
  confirmationStatus?: DepositConfirmationStatus;
  confirmations?: number;
  requiredConfirmations?: number;
  className?: string;
}) {
  const steps = [
    {
      label: "Tạo lệnh",
      complete: true,
    },
    {
      label: "Provider xác nhận",
      complete:
        status === DepositIntentStatus.CONFIRMING ||
        status === DepositIntentStatus.PAID ||
        confirmationStatus === DepositConfirmationStatus.PARTIALLY_CONFIRMED ||
        confirmationStatus === DepositConfirmationStatus.CONFIRMED,
    },
    {
      label: "Cộng ví",
      complete: status === DepositIntentStatus.PAID,
    },
  ];

  return (
    <div className={cn("grid gap-3 sm:grid-cols-3", className)}>
      {steps.map((step) => (
        <div
          className={
            step.complete
              ? "border border-[#b8e8ca] bg-[#e8f7ef] p-3 text-[#007d3e]"
              : "border border-[#d3dae6] bg-[#f5f7fa] p-3 text-[#686d77]"
          }
          key={step.label}
        >
          <div className="flex items-center gap-2">
            {step.complete ? (
              <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4 shrink-0" aria-hidden="true" />
            )}
            <p className="text-sm font-black">{step.label}</p>
          </div>
          {step.label === "Provider xác nhận" && typeof confirmations === "number" ? (
            <p className="mt-1 text-xs font-bold">
              {confirmations}/{requiredConfirmations ?? confirmations} confirmations
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
