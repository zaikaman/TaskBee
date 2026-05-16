import { requireRole } from "@/lib/auth/session";
import { UserRole } from "@/lib/generated/prisma/client";
import { getDepositIntents, getWalletBalance } from "@/lib/services/wallet";
import { DepositPageClient } from "./deposit-page-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nạp tiền | TaskBee",
  description: "Tạo lệnh nạp tiền SePay hoặc USDT cho ví nhà tuyển dụng TaskBee.",
};

type EmployerDepositPageProps = {
  searchParams?: Promise<{
    method?: string;
  }>;
};

function normalizeInitialMethod(method: string | undefined) {
  return method?.toUpperCase() === "USDT" ? "USDT" : "SEPAY";
}

export default async function EmployerDepositPage({ searchParams }: EmployerDepositPageProps) {
  await requireRole(UserRole.EMPLOYER);

  const [params, balance, depositHistory] = await Promise.all([
    searchParams ?? Promise.resolve<{ method?: string }>({}),
    getWalletBalance(),
    getDepositIntents(1, 8),
  ]);
  const latestActiveIntent =
    depositHistory.depositIntents.find((intent) =>
      ["PENDING", "CONFIRMING"].includes(intent.status),
    ) ?? depositHistory.depositIntents[0] ?? null;

  return (
    <DepositPageClient
      balance={balance}
      initialDepositMethod={normalizeInitialMethod(params.method)}
      initialDepositIntent={latestActiveIntent}
      recentDepositIntents={depositHistory.depositIntents}
      refreshIntervalSeconds={10}
    />
  );
}
