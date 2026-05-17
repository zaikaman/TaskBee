import { reconcileLedger } from "@/lib/services/ledger";

const prismaMock = {
  user: {
    findMany: jest.fn(),
  },
  transaction: {
    findMany: jest.fn(),
  },
  withdrawal: {
    findMany: jest.fn(),
  },
  task: {
    findMany: jest.fn(),
  },
  depositIntent: {
    findMany: jest.fn(),
  },
  manualDeposit: {
    findMany: jest.fn(),
  },
};

jest.mock("@/lib/db/prisma", () => ({
  getPrisma: () => prismaMock,
}));

describe("ledger reconciliation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        email: "worker@taskbee.vn",
        availableBalance: { toString: () => "100000.00" },
        pendingBalance: { toString: () => "0.00" },
        escrowBalance: { toString: () => "0.00" },
      },
    ]);
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: "tx-1",
        userId: "user-1",
        type: "DEPOSIT",
        amount: "100000.00",
        balanceAfter: "100000.00",
        referenceId: "deposit-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
    prismaMock.withdrawal.findMany.mockResolvedValue([]);
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.depositIntent.findMany.mockResolvedValue([{ id: "deposit-1" }]);
    prismaMock.manualDeposit.findMany.mockResolvedValue([]);
  });

  it("xác nhận ví và ledger nhất quán", async () => {
    const result = await reconcileLedger({ includeHealthyUsers: true });

    expect(result.summary.isConsistent).toBe(true);
    expect(result.summary.errorCount).toBe(0);
    expect(result.users[0]?.totalBalance).toBe("100000.00");
  });

  it("phát hiện balanceAfter cuối cùng lệch với số dư ví", async () => {
    prismaMock.user.findMany.mockResolvedValueOnce([
      {
        id: "user-1",
        email: "worker@taskbee.vn",
        availableBalance: { toString: () => "90000.00" },
        pendingBalance: { toString: () => "0.00" },
        escrowBalance: { toString: () => "0.00" },
      },
    ]);

    const result = await reconcileLedger({ includeHealthyUsers: true });

    expect(result.summary.isConsistent).toBe(false);
    expect(result.issues.some((issue) => issue.code === "TRANSACTION_BALANCE_FINAL_MISMATCH")).toBe(true);
  });

  it("khong coi worker-to-employer transfer la thay doi availableBalance", async () => {
    prismaMock.transaction.findMany.mockResolvedValueOnce([
      {
        id: "tx-1",
        userId: "user-1",
        type: "DEPOSIT",
        amount: "100000.00",
        balanceAfter: "100000.00",
        referenceId: "deposit-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: "tx-2",
        userId: "user-1",
        type: "WORKER_TO_EMPLOYER_TRANSFER",
        amount: "-20000.00",
        balanceAfter: "100000.00",
        referenceId: null,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ]);

    const result = await reconcileLedger({ includeHealthyUsers: true });

    expect(result.summary.isConsistent).toBe(true);
    expect(result.summary.errorCount).toBe(0);
  });
});
