import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bitcoin,
  CircleDollarSign,
  Landmark,
  ShieldAlert,
} from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";
import { requireVerifiedUser } from "@/lib/auth/session";
import { UserRole, type TransactionType } from "@/lib/generated/prisma/client";
import {
  getTransactionHistory,
  getWalletBalance,
  getWithdrawalRequests,
  type TransactionHistoryItem,
} from "@/lib/services/wallet";
import { formatVnd, toMinorUnits } from "@/lib/utils/money";
import { EmployerBudgetTransferSection } from "./employer-budget-transfer-section";
import { SePayDepositSection } from "./sepay-deposit-section";

export const dynamic = "force-dynamic";

type WalletPageProps = {
  searchParams?: Promise<{
    tab?: string;
  }>;
};

type WalletTab = {
  key: string;
  label: string;
};

type MonthlyReward = {
  label: string;
  amount: string;
  amountMinor: bigint;
};

const employerTabs: WalletTab[] = [
  { key: "deposit", label: "Nạp tiền" },
  { key: "transactions", label: "Giao dịch" },
  { key: "packs", label: "Gói việc nổi bật" },
  { key: "billing", label: "Hóa đơn" },
];

const workerTabs: WalletTab[] = [
  { key: "withdrawals", label: "Rút tiền" },
  { key: "transactions", label: "Giao dịch" },
  { key: "crypto", label: "Địa chỉ crypto" },
];

const quickDepositAmounts = ["100000", "250000", "500000", "750000", "1000000", "2000000"];

function normalizeTab(tab: string | undefined, tabs: WalletTab[]) {
  return tabs.some((item) => item.key === tab) ? tab! : tabs[0].key;
}

function formatWalletAmount(value: string | undefined) {
  return formatVnd(value ?? "0");
}

function buildMonthlyRewards(transactions: TransactionHistoryItem[]) {
  const now = new Date();
  const months = Array.from({ length: 3 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (2 - index), 1);

    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: new Intl.DateTimeFormat("vi-VN", { month: "short" }).format(date),
      amountMinor: BigInt(0),
    };
  });

  for (const transaction of transactions) {
    if (transaction.type !== "TASK_REWARD") {
      continue;
    }

    const createdAt = new Date(transaction.createdAt);
    const month = months.find(
      (item) => item.key === `${createdAt.getFullYear()}-${createdAt.getMonth()}`,
    );

    if (month) {
      month.amountMinor += toMinorUnits(transaction.amount);
    }
  }

  return months.map((month) => ({
    label: month.label,
    amount: formatVnd(month.amountMinor),
    amountMinor: month.amountMinor,
  }));
}

function WalletTabs({ tabs, activeTab }: { tabs: WalletTab[]; activeTab: string }) {
  return (
    <nav className="flex gap-10 border-b border-[#d3dae6] text-sm font-bold uppercase text-[#001b49]">
      {tabs.map((tab) => (
        <Link
          className={
            activeTab === tab.key
              ? "border-b-2 border-[#22ab59] pb-5 text-[#001b49]"
              : "pb-5 text-[#001b49] hover:text-[#22ab59]"
          }
          href={tab.key === "deposit" ? "/dashboard/wallet/deposit" : `/dashboard/wallet?tab=${tab.key}`}
          key={tab.key}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function SecurityNotice() {
  return (
    <div className="flex items-start justify-between bg-[#fff3cf] px-4 py-3 text-sm font-medium text-[#996500]">
      <div className="flex gap-3">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[#22ab59]" />
        <p>
          Hãy bảo vệ tài khoản của bạn. Thêm email khôi phục và kiểm tra bảo mật để không bị gián
          đoạn khi rút hoặc nạp tiền.
        </p>
      </div>
      <span aria-hidden="true" className="font-bold">
        ×
      </span>
    </div>
  );
}

function BalanceStrip({ balance }: { balance: Awaited<ReturnType<typeof getWalletBalance>> }) {
  const items = [
    { label: "Khả dụng", value: formatWalletAmount(balance?.availableBalance) },
    { label: "Chờ xử lý", value: formatWalletAmount(balance?.pendingBalance) },
    { label: "Ký quỹ", value: formatWalletAmount(balance?.escrowBalance) },
  ];

  return (
    <dl className="mb-8 grid gap-3 text-sm sm:grid-cols-3">
      {items.map((item) => (
        <div className="bg-[#f5f7fa] px-4 py-3" key={item.label}>
          <dt className="font-medium text-[#686d77]">{item.label}</dt>
          <dd className="mt-1 font-bold text-[#00a650]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function EarningsCard({
  title,
  months,
  currentEarned,
  currentPending,
}: {
  title: string;
  months: MonthlyReward[];
  currentEarned: string;
  currentPending: string;
}) {
  const totalLastThreeMonths = months.reduce(
    (total, month) => total + month.amountMinor,
    BigInt(0),
  );

  return (
    <section className="bg-[#f5f7fa] text-[#001b49] shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
      <div className="grid gap-0 lg:grid-cols-[260px_1fr]">
        <div className="border-b border-white/80 p-8 lg:border-b-0 lg:border-r">
          <p className="text-xs font-bold uppercase text-[#686d77]">Tổng quan thu nhập</p>
          <h2 className="mt-3 text-xl font-black">{title}</h2>
          <dl className="mt-6">
            <dt className="text-sm font-medium text-[#686d77]">Tổng 3 tháng gần nhất</dt>
            <dd className="mt-1 text-2xl font-black text-[#00a650]">
              {formatVnd(totalLastThreeMonths)}
            </dd>
          </dl>
        </div>

        <div className="grid gap-px bg-white/80 sm:grid-cols-2 lg:grid-cols-5">
          {months.map((month) => (
            <div className="bg-[#f5f7fa] p-6" key={month.label}>
              <p className="text-sm font-bold text-[#686d77]">{month.label}</p>
              <p className="mt-4 text-lg font-black text-[#00a650]">{month.amount}</p>
            </div>
          ))}
          <div className="bg-[#f5f7fa] p-6">
            <p className="text-sm font-bold text-[#686d77]">Đã kiếm tháng này</p>
            <p className="mt-4 text-lg font-black text-[#00a650]">{currentEarned}</p>
          </div>
          <div className="bg-[#f5f7fa] p-6">
            <p className="text-sm font-bold text-[#686d77]">Chờ duyệt</p>
            <p className="mt-4 text-lg font-black text-[#00a650]">{currentPending}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkerEarningsOverview({
  months,
  balance,
}: {
  months: MonthlyReward[];
  balance: Awaited<ReturnType<typeof getWalletBalance>>;
}) {
  return (
    <div className="grid gap-4">
      <EarningsCard
        currentEarned={formatWalletAmount(balance?.availableBalance)}
        currentPending={formatWalletAmount(balance?.pendingBalance)}
        months={months}
        title="Thu nhập việc nhỏ"
      />

      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="bg-[#f5f7fa] px-4 py-3">
          <dt className="font-medium text-[#686d77]">Có thể rút</dt>
          <dd className="mt-1 font-bold text-[#00a650]">{formatWalletAmount(balance?.availableBalance)}</dd>
        </div>
        <div className="bg-[#f5f7fa] px-4 py-3">
          <dt className="font-medium text-[#686d77]">Đang chờ duyệt</dt>
          <dd className="mt-1 font-bold text-[#00a650]">{formatWalletAmount(balance?.pendingBalance)}</dd>
        </div>
        <div className="bg-[#f5f7fa] px-4 py-3">
          <dt className="font-medium text-[#686d77]">Trạng thái rút tiền</dt>
          <dd className="mt-1 font-bold text-[#001b49]">Cần xác minh hồ sơ</dd>
        </div>
      </dl>
    </div>
  );
}

function AlertBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 bg-[#fce3e5] px-4 py-3 text-sm font-medium text-[#8a1218]">
      <AlertTriangle className="size-4 shrink-0 text-[#e63e46]" />
      <p>{children}</p>
    </div>
  );
}

function WorkerWallet({
  activeTab,
  transactions,
  months,
  balance,
  withdrawalCount,
}: {
  activeTab: string;
  transactions: TransactionHistoryItem[];
  months: MonthlyReward[];
  balance: Awaited<ReturnType<typeof getWalletBalance>>;
  withdrawalCount: number;
}) {
  return (
    <>
      <WorkerEarningsOverview balance={balance} months={months} />

      <div className="mt-8">
        <WalletTabs activeTab={activeTab} tabs={workerTabs} />
      </div>

      {activeTab === "withdrawals" ? (
        <section className="mt-6 space-y-4">
          <AlertBar>Người dùng mới cần đủ 7 ngày trước khi gửi yêu cầu rút tiền đầu tiên.</AlertBar>
          <AlertBar>
            Trước khi rút tiền, bạn cần hoàn tất thông tin danh tính và tài khoản ngân hàng trong
            phần hồ sơ.
          </AlertBar>
          <button
            className="h-11 w-full bg-[#a9a9a9] text-sm font-bold uppercase text-white"
            disabled
            type="button"
          >
            Yêu cầu rút tiền
          </button>
          <div className="bg-[#f5f7fa] py-5 text-center text-sm text-[#001b49]">
            {withdrawalCount > 0
              ? `Bạn có ${withdrawalCount} yêu cầu rút tiền đang được ghi nhận.`
              : "Bạn chưa gửi yêu cầu rút tiền nào."}
          </div>
        </section>
      ) : null}

      {activeTab === "transactions" ? <TransactionsPanel transactions={transactions} /> : null}

      {activeTab === "crypto" ? (
        <section className="mt-6 bg-[#f5f7fa] p-6 text-center text-sm text-[#001b49]">
          Chưa có địa chỉ crypto nào được liên kết với tài khoản của bạn.
        </section>
      ) : null}
    </>
  );
}

function PaymentBox({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white text-[#001b49] shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
      <header className="flex min-h-28 items-center gap-4 bg-[#f2f3f5] px-6 py-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#001b49] text-white">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          {subtitle ? <p className="mt-2 font-bold text-[#00a650]">{subtitle}</p> : null}
        </div>
      </header>
      <div className="p-6">{children}</div>
    </section>
  );
}

function EmployerDepositPanel({ balance }: { balance: Awaited<ReturnType<typeof getWalletBalance>> }) {
  return (
    <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
      <div className="grid gap-3">
        <PaymentBox
          icon={<Landmark className="size-5" />}
          subtitle="Tự động ghi nhận khi SePay xác nhận giao dịch"
          title="Chuyển khoản ngân hàng qua SePay"
        >
          <SePayDepositSection quickDepositAmounts={quickDepositAmounts} />
        </PaymentBox>
      </div>

      <div className="grid gap-3">
        <PaymentBox
          icon={<Bitcoin className="size-5" />}
          subtitle="Hỗ trợ USDT theo mạng được cấu hình trong hệ thống"
          title="Nạp crypto USDT"
        >
          <div className="leading-7 text-[#001b49]">
            <p className="font-medium">Tạo lệnh nạp USDT với địa chỉ ví theo mạng đã cấu hình.</p>
            <p className="mt-3">
              Sau khi provider xác nhận đủ confirmation, khoản nạp USDT sẽ được cộng vào ngân sách employer.
            </p>
            <Link
              className="mt-5 inline-flex h-10 items-center justify-center gap-2 bg-[#22ab59] px-4 text-sm font-bold uppercase text-white transition-colors hover:bg-[#005924]"
              href="/dashboard/wallet/deposit?method=USDT"
            >
              Tạo lệnh nạp USDT
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </PaymentBox>

        <PaymentBox icon={<CircleDollarSign className="size-5" />} title="Ngân sách employer">
          <EmployerBudgetTransferSection
            employerAvailableBalance={balance?.employerAvailableBalance ?? "0"}
            workerAvailableBalance={balance?.workerAvailableBalance ?? "0"}
          />
        </PaymentBox>
      </div>
    </div>
  );
}

function TransactionsPanel({ transactions }: { transactions: TransactionHistoryItem[] }) {
  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-col gap-3 text-sm text-[#001b49] sm:flex-row sm:items-center sm:justify-between">
        <p>{transactions.length} giao dịch</p>
        <div className="flex gap-8 font-bold">
          <span>Kỳ / 2026</span>
          <span>Trạng thái / Tất cả</span>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="bg-[#f5f7fa] py-5 text-center text-sm text-[#001b49]">
          Bạn chưa có giao dịch nào.
        </div>
      ) : (
        <div className="overflow-hidden bg-white shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
          <table className="w-full text-left text-sm text-[#001b49]">
            <thead className="bg-[#f5f7fa] font-bold">
              <tr>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Loại</th>
                <th className="px-4 py-3 text-right">Số tiền</th>
                <th className="px-4 py-3 text-right">Số dư sau</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr className="border-t border-[#f0f2f5]" key={transaction.id}>
                  <td className="px-4 py-3">
                    {new Intl.DateTimeFormat("vi-VN", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(transaction.createdAt))}
                  </td>
                  <td className="px-4 py-3">{translateTransactionType(transaction.type)}</td>
                  <td className="px-4 py-3 text-right font-bold text-[#00a650]">
                    {formatVnd(transaction.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">{formatVnd(transaction.balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function translateTransactionType(type: TransactionType) {
  const labels: Record<TransactionType, string> = {
    ADMIN_ADJUSTMENT: "Điều chỉnh admin",
    DEPOSIT: "Nạp tiền",
    DEPOSIT_FEE: "Phí nạp tiền",
    TASK_CREATION_FEE: "Phí tạo việc",
    TASK_ESCROW_LOCK: "Khóa ký quỹ",
    TASK_ESCROW_RELEASE: "Hoàn ký quỹ",
    TASK_REWARD: "Thưởng nhiệm vụ",
    WORKER_TO_EMPLOYER_TRANSFER: "Chuyển sang ngân sách employer",
    WITHDRAWAL: "Rút tiền",
    WITHDRAWAL_FEE: "Phí rút tiền",
  };

  return labels[type];
}

function EmployerWallet({
  activeTab,
  transactions,
  balance,
}: {
  activeTab: string;
  transactions: TransactionHistoryItem[];
  balance: Awaited<ReturnType<typeof getWalletBalance>>;
}) {
  return (
    <>
      <WalletTabs activeTab={activeTab} tabs={employerTabs} />
      {activeTab === "deposit" ? <EmployerDepositPanel balance={balance} /> : null}
      {activeTab === "transactions" ? <TransactionsPanel transactions={transactions} /> : null}
      {activeTab === "packs" ? (
        <section className="mt-6 bg-[#f5f7fa] p-6 text-center text-sm text-[#001b49]">
          Gói việc nổi bật sẽ được mở sau khi luồng nạp tiền tự động hoàn tất.
        </section>
      ) : null}
      {activeTab === "billing" ? (
        <section className="mt-6 bg-[#f5f7fa] p-6 text-center text-sm text-[#001b49]">
          Chưa có hóa đơn nào được ghi nhận.
        </section>
      ) : null}
    </>
  );
}

export default async function WalletPage({ searchParams }: WalletPageProps) {
  const fallbackSearchParams: NonNullable<WalletPageProps["searchParams"]> = Promise.resolve({});
  const [{ profile }, balance, transactions, withdrawals, params] = await Promise.all([
    requireVerifiedUser(),
    getWalletBalance(),
    getTransactionHistory(1, 25),
    getWithdrawalRequests(undefined, 1, 10),
    searchParams ?? fallbackSearchParams,
  ]);

  const isEmployer = profile?.role === UserRole.EMPLOYER;
  const tabs = isEmployer ? employerTabs : workerTabs;
  const activeTab = normalizeTab(params.tab, tabs);
  const monthlyRewards = buildMonthlyRewards(transactions.transactions);

  return (
    <div className="mx-auto max-w-[1050px] pb-1 pt-2 text-[#001b49]">
      <SecurityNotice />

      <div className="mt-16">
        <h1 className="mb-9 text-3xl font-black tracking-normal text-[#001b49]">Ví tiền</h1>
        <BalanceStrip balance={balance} />

        {isEmployer ? (
          <EmployerWallet
            activeTab={activeTab}
            balance={balance}
            transactions={transactions.transactions}
          />
        ) : (
          <WorkerWallet
            activeTab={activeTab}
            balance={balance}
            months={monthlyRewards}
            transactions={transactions.transactions}
            withdrawalCount={withdrawals.pagination.totalCount}
          />
        )}
      </div>

      <div className="mt-20">
        <SiteFooter />
      </div>
    </div>
  );
}
