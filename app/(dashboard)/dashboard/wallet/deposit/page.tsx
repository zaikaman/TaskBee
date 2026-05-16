import { requireRole } from "@/lib/auth/session";
import { UserRole } from "@/lib/generated/prisma/client";
import { getDepositIntents, getWalletBalance } from "@/lib/services/wallet";
import { DepositPageClient } from "./deposit-page-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nạp tiền | TaskBee",
  description: "Tạo lệnh nạp tiền SePay hoặc USDT cho ví nhà tuyển dụng TaskBee.",
};

export default async function EmployerDepositPage() {
  await requireRole(UserRole.EMPLOYER);

  const [balance, depositHistory] = await Promise.all([
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
      initialDepositIntent={latestActiveIntent}
      recentDepositIntents={depositHistory.depositIntents}
      refreshIntervalSeconds={10}
    />
  );
}
