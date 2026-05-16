import { CheckCircle2, XCircle } from "lucide-react";
import { getPrisma } from "@/lib/db/prisma";
import {
  DepositConfirmationStatus,
  DepositIntentStatus,
  DepositProvider,
} from "@/lib/generated/prisma/client";
import { processDepositException } from "@/lib/services/admin";
import { formatVnd } from "@/lib/utils/money";

export const dynamic = "force-dynamic";

type DepositsPageProps = {
  searchParams?: Promise<{
    status?: string;
    provider?: string;
  }>;
};

const exceptionStatuses: DepositIntentStatus[] = [
  DepositIntentStatus.FAILED,
  DepositIntentStatus.UNDERPAID,
  DepositIntentStatus.OVERPAID,
  DepositIntentStatus.MANUAL_REVIEW_REQUIRED,
];

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function normalizeStatus(status?: string) {
  return Object.values(DepositIntentStatus).includes(status as DepositIntentStatus)
    ? (status as DepositIntentStatus)
    : undefined;
}

function normalizeProvider(provider?: string) {
  return Object.values(DepositProvider).includes(provider as DepositProvider)
    ? (provider as DepositProvider)
    : undefined;
}

function stringifyJson(value: unknown) {
  if (value === null || value === undefined) {
    return "Không có metadata";
  }

  return JSON.stringify(value, null, 2);
}

export default async function AdminDepositsPage({ searchParams }: DepositsPageProps) {
  async function processDepositExceptionForm(formData: FormData) {
    "use server";

    await processDepositException(formData);
  }

  const params: Awaited<NonNullable<DepositsPageProps["searchParams"]>> = searchParams
    ? await searchParams
    : {};
  const status = normalizeStatus(params.status);
  const provider = normalizeProvider(params.provider);
  const prisma = getPrisma();
  const depositIntents = await prisma.depositIntent.findMany({
    where: {
      status: status ? status : { in: exceptionStatuses },
      ...(provider ? { provider } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      userId: true,
      amount: true,
      currency: true,
      status: true,
      provider: true,
      providerReference: true,
      providerTransactionId: true,
      providerEventId: true,
      paymentCode: true,
      paymentMethod: true,
      network: true,
      destinationAddress: true,
      confirmationStatus: true,
      confirmations: true,
      requiredConfirmations: true,
      rawProviderMetadata: true,
      confirmedAmount: true,
      confirmedAt: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          email: true,
          status: true,
          availableBalance: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-emerald-300">Đối soát</p>
          <h1 className="mt-2 text-3xl font-black tracking-normal text-white">Ngoại lệ nạp tiền</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Rà soát các khoản nạp lỗi, thiếu, dư hoặc cần kiểm tra thủ công trước khi ghi có ví.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <a className="rounded bg-white/10 px-3 py-2 font-bold text-slate-200 hover:bg-white/15" href="/admin/deposits">
            Cần rà soát
          </a>
          {Object.values(DepositProvider).map((item) => (
            <a
              className={
                item === provider
                  ? "rounded bg-emerald-500 px-3 py-2 font-bold text-white"
                  : "rounded bg-white/10 px-3 py-2 font-bold text-slate-200 hover:bg-white/15"
              }
              href={`/admin/deposits?provider=${item}`}
              key={item}
            >
              {item}
            </a>
          ))}
        </div>
      </header>

      <section className="overflow-hidden rounded-lg bg-white text-[#001b49]">
        <div className="border-b border-[#f0f2f5] px-5 py-4">
          <h2 className="font-bold">{depositIntents.length} lệnh nạp tiền</h2>
        </div>

        {depositIntents.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[#686d77]">Không có lệnh nạp tiền cần rà soát.</p>
        ) : (
          <div className="divide-y divide-[#f0f2f5]">
            {depositIntents.map((intent) => {
              const canReview =
                exceptionStatuses.includes(intent.status) &&
                intent.confirmationStatus !== DepositConfirmationStatus.CONFIRMED;

              return (
                <article className="grid gap-5 px-5 py-5 xl:grid-cols-[1fr_420px]" key={intent.id}>
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-4">
                      <div>
                        <p className="text-xs font-bold uppercase text-[#686d77]">Người dùng</p>
                        <p className="mt-1 font-bold">{intent.user.email}</p>
                        <p className="mt-1 text-sm text-[#686d77]">Tài khoản: {intent.user.status}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase text-[#686d77]">Số tiền kỳ vọng</p>
                        <p className="mt-1 text-xl font-black text-[#00a650]">
                          {formatVnd(intent.amount.toString())}
                        </p>
                        <p className="mt-1 text-sm text-[#686d77]">
                          Đã xác nhận: {intent.confirmedAmount ? formatVnd(intent.confirmedAmount.toString()) : "Chưa có"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase text-[#686d77]">Provider</p>
                        <p className="mt-1 font-bold">{intent.provider}</p>
                        <p className="mt-1 text-sm text-[#686d77]">
                          {intent.network ?? intent.paymentMethod} · {intent.confirmations}/{intent.requiredConfirmations}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase text-[#686d77]">Trạng thái</p>
                        <p className="mt-1 font-bold text-[#e63e46]">{intent.status}</p>
                        <p className="mt-1 text-sm text-[#686d77]">{intent.confirmationStatus}</p>
                      </div>
                    </div>

                    <div className="grid gap-3 rounded bg-[#f5f7fa] p-4 text-sm md:grid-cols-2">
                      <p>
                        <span className="font-bold">Mã thanh toán:</span> {intent.paymentCode}
                      </p>
                      <p>
                        <span className="font-bold">Provider reference:</span>{" "}
                        {intent.providerReference ?? "Chưa có"}
                      </p>
                      <p>
                        <span className="font-bold">Transaction ID:</span>{" "}
                        {intent.providerTransactionId ?? "Chưa có"}
                      </p>
                      <p>
                        <span className="font-bold">Event ID:</span> {intent.providerEventId ?? "Chưa có"}
                      </p>
                      <p>
                        <span className="font-bold">Tạo:</span> {formatDate(intent.createdAt)}
                      </p>
                      <p>
                        <span className="font-bold">Cập nhật:</span> {formatDate(intent.updatedAt)}
                      </p>
                    </div>

                    <details className="rounded bg-slate-950 text-slate-100">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-bold">
                        Metadata provider
                      </summary>
                      <pre className="max-h-72 overflow-auto border-t border-white/10 p-4 text-xs leading-5">
                        {stringifyJson(intent.rawProviderMetadata)}
                      </pre>
                    </details>
                  </div>

                  {canReview ? (
                    <div className="grid gap-3 rounded bg-[#f5f7fa] p-4">
                      <form action={processDepositExceptionForm} className="grid gap-3">
                        <input name="depositIntentId" type="hidden" value={intent.id} />
                        <input name="action" type="hidden" value="APPROVE_CREDIT" />
                        <label className="grid gap-2 text-sm font-bold">
                          Số tiền ghi có
                          <input
                            className="h-10 bg-white px-3 font-medium outline-none ring-1 ring-[#d3dae6] focus:ring-[#22ab59]"
                            defaultValue={intent.confirmedAmount?.toString() ?? intent.amount.toString()}
                            inputMode="numeric"
                            name="creditAmount"
                            required
                          />
                        </label>
                        <textarea
                          className="min-h-24 bg-white px-3 py-2 text-sm outline-none ring-1 ring-[#d3dae6] focus:ring-[#22ab59]"
                          name="reason"
                          placeholder="Bằng chứng và lý do ghi có thủ công"
                          required
                        />
                        <button className="inline-flex h-10 items-center justify-center gap-2 rounded bg-emerald-500 px-4 text-sm font-bold text-white hover:bg-emerald-600">
                          <CheckCircle2 className="size-4" />
                          Ghi có sau rà soát
                        </button>
                      </form>

                      <form action={processDepositExceptionForm} className="grid gap-3">
                        <input name="depositIntentId" type="hidden" value={intent.id} />
                        <input name="action" type="hidden" value="REJECT" />
                        <textarea
                          className="min-h-24 bg-white px-3 py-2 text-sm outline-none ring-1 ring-[#d3dae6] focus:ring-[#e63e46]"
                          name="reason"
                          placeholder="Lý do từ chối sau khi đối soát provider"
                          required
                        />
                        <button className="inline-flex h-10 items-center justify-center gap-2 rounded bg-rose-500 px-4 text-sm font-bold text-white hover:bg-rose-600">
                          <XCircle className="size-4" />
                          Từ chối lệnh nạp
                        </button>
                      </form>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
