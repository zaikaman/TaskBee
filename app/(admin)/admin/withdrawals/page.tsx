import { CheckCircle2, XCircle } from "lucide-react";
import { processWithdrawal } from "@/lib/services/admin";
import { getPrisma } from "@/lib/db/prisma";
import { WithdrawalStatus } from "@/lib/generated/prisma/client";
import { formatVnd } from "@/lib/utils/money";
import { AdminPagination, normalizeAdminPage } from "../_components/admin-pagination";

export const dynamic = "force-dynamic";

type WithdrawalPageProps = {
  searchParams?: Promise<{
    page?: string;
    status?: string;
  }>;
};

const pageSize = 10;

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function readBankDetails(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      bankName: "Chưa rõ ngân hàng",
      accountNumber: "Chưa rõ số tài khoản",
      accountHolder: "Chưa rõ chủ tài khoản",
    };
  }

  const details = value as Record<string, unknown>;

  return {
    bankName: String(details.bankName ?? details.bankCode ?? "Chưa rõ ngân hàng"),
    accountNumber: String(details.accountNumber ?? "Chưa rõ số tài khoản"),
    accountHolder: String(details.accountHolder ?? details.accountName ?? "Chưa rõ chủ tài khoản"),
  };
}

function normalizeStatus(status?: string) {
  return Object.values(WithdrawalStatus).includes(status as WithdrawalStatus)
    ? (status as WithdrawalStatus)
    : WithdrawalStatus.PENDING;
}

export default async function AdminWithdrawalsPage({ searchParams }: WithdrawalPageProps) {
  async function processWithdrawalForm(formData: FormData) {
    "use server";

    await processWithdrawal(formData);
  }

  const params: Awaited<NonNullable<WithdrawalPageProps["searchParams"]>> = searchParams
    ? await searchParams
    : {};
  const status = normalizeStatus(params.status);
  const page = normalizeAdminPage(params.page);
  const skip = (page - 1) * pageSize;
  const prisma = getPrisma();
  const where = { status };
  const [withdrawals, totalCount] = await Promise.all([
    prisma.withdrawal.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        amount: true,
        fee: true,
        netAmount: true,
        status: true,
        bankDetails: true,
        adminFeedback: true,
        processedAt: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            status: true,
            availableBalance: true,
            pendingBalance: true,
          },
        },
      },
    }),
    prisma.withdrawal.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-[#00a650]">Dòng tiền</p>
          <h1 className="mt-2 text-3xl font-black tracking-normal text-[#001b49]">Yêu cầu rút tiền</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4a5568]">
            Kiểm tra số dư pending, thông tin ngân hàng và duyệt hoặc từ chối từng yêu cầu trong transaction an toàn.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          {Object.values(WithdrawalStatus).map((item) => (
            <a
              className={
                item === status
                  ? "rounded bg-emerald-500 px-3 py-2 font-bold text-white"
                  : "rounded bg-white px-3 py-2 font-bold text-[#203259] ring-1 ring-[#d3dae6] hover:bg-[#e7faef] hover:text-[#005924]"
              }
              href={`/admin/withdrawals?status=${item}&page=1`}
              key={item}
            >
              {item}
            </a>
          ))}
        </nav>
      </header>

      <section className="overflow-hidden rounded-lg bg-white text-[#001b49] shadow-[0_2px_10px_rgba(0,0,0,0.06)] ring-1 ring-[#f0f2f5]">
        <div className="border-b border-[#f0f2f5] px-5 py-4">
          <h2 className="font-bold">{totalCount} yêu cầu</h2>
        </div>

        {withdrawals.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[#686d77]">Không có yêu cầu rút tiền trong trạng thái này.</p>
        ) : (
          <div className="divide-y divide-[#f0f2f5]">
            {withdrawals.map((withdrawal) => {
              const bankDetails = readBankDetails(withdrawal.bankDetails);

              return (
                <article className="grid gap-5 px-5 py-5 xl:grid-cols-[1fr_380px]" key={withdrawal.id}>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-[#686d77]">Người dùng</p>
                      <p className="mt-1 font-bold">{withdrawal.user.email}</p>
                      <p className="mt-1 text-sm text-[#686d77]">Trạng thái: {withdrawal.user.status}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-[#686d77]">Số tiền</p>
                      <p className="mt-1 text-xl font-black text-[#00a650]">
                        {formatVnd(withdrawal.amount.toString())}
                      </p>
                      <p className="mt-1 text-sm text-[#686d77]">
                        Phí {formatVnd(withdrawal.fee.toString())} · thực nhận {formatVnd(withdrawal.netAmount.toString())}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-[#686d77]">Ngân hàng</p>
                      <p className="mt-1 font-bold">{bankDetails.bankName}</p>
                      <p className="mt-1 text-sm text-[#686d77]">
                        {bankDetails.accountNumber} · {bankDetails.accountHolder}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-[#686d77]">Ví hiện tại</p>
                      <p className="mt-1 text-sm text-[#4a5568]">
                        Khả dụng {formatVnd(withdrawal.user.availableBalance.toString())}
                      </p>
                      <p className="mt-1 text-sm text-[#4a5568]">
                        Pending {formatVnd(withdrawal.user.pendingBalance.toString())}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-[#686d77]">Thời gian</p>
                      <p className="mt-1 text-sm text-[#4a5568]">Tạo {formatDate(withdrawal.createdAt)}</p>
                      {withdrawal.processedAt ? (
                        <p className="mt-1 text-sm text-[#4a5568]">Xử lý {formatDate(withdrawal.processedAt)}</p>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-[#686d77]">Ghi chú admin</p>
                      <p className="mt-1 text-sm text-[#4a5568]">{withdrawal.adminFeedback ?? "Chưa có"}</p>
                    </div>
                  </div>

                  {withdrawal.status === WithdrawalStatus.PENDING ? (
                    <div className="grid gap-3 rounded bg-[#f5f7fa] p-4">
                      <form action={processWithdrawalForm} className="grid gap-3">
                        <input name="withdrawalId" type="hidden" value={withdrawal.id} />
                        <input name="action" type="hidden" value="APPROVE" />
                        <textarea
                          className="min-h-20 w-full bg-white px-3 py-2 text-sm outline-none ring-1 ring-[#d3dae6] focus:ring-[#22ab59]"
                          name="adminFeedback"
                          placeholder="Ghi chú duyệt cho audit và thông báo"
                        />
                        <button className="inline-flex h-10 items-center justify-center gap-2 rounded bg-emerald-500 px-4 text-sm font-bold text-white hover:bg-emerald-600">
                          <CheckCircle2 className="size-4" />
                          Duyệt rút tiền
                        </button>
                      </form>
                      <form action={processWithdrawalForm} className="grid gap-3">
                        <input name="withdrawalId" type="hidden" value={withdrawal.id} />
                        <input name="action" type="hidden" value="REJECT" />
                        <textarea
                          className="min-h-20 w-full bg-white px-3 py-2 text-sm outline-none ring-1 ring-[#d3dae6] focus:ring-[#e63e46]"
                          name="adminFeedback"
                          placeholder="Lý do từ chối bắt buộc tối thiểu 10 ký tự"
                          required
                        />
                        <button className="inline-flex h-10 items-center justify-center gap-2 rounded bg-rose-500 px-4 text-sm font-bold text-white hover:bg-rose-600">
                          <XCircle className="size-4" />
                          Từ chối và hoàn tiền
                        </button>
                      </form>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
        <AdminPagination
          basePath="/admin/withdrawals"
          page={page}
          pageSize={pageSize}
          params={{ status }}
          totalCount={totalCount}
        />
      </section>
    </div>
  );
}
