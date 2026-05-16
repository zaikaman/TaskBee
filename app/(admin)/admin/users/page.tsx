import { ShieldBan, UserCog } from "lucide-react";
import { getPrisma } from "@/lib/db/prisma";
import { UserRole, UserStatus } from "@/lib/generated/prisma/client";
import { updateUserManagement } from "@/lib/services/admin";
import { formatVnd } from "@/lib/utils/money";
import { AdminPagination, normalizeAdminPage } from "../_components/admin-pagination";

export const dynamic = "force-dynamic";

type UsersPageProps = {
  searchParams?: Promise<{
    page?: string;
    q?: string;
    role?: string;
    status?: string;
  }>;
};

const pageSize = 10;

function normalizeRole(role?: string) {
  return Object.values(UserRole).includes(role as UserRole) ? (role as UserRole) : undefined;
}

function normalizeStatus(status?: string) {
  return Object.values(UserStatus).includes(status as UserStatus)
    ? (status as UserStatus)
    : undefined;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

export default async function AdminUsersPage({ searchParams }: UsersPageProps) {
  async function updateUserManagementForm(formData: FormData) {
    "use server";

    await updateUserManagement(formData);
  }

  const params: Awaited<NonNullable<UsersPageProps["searchParams"]>> = searchParams
    ? await searchParams
    : {};
  const query = params.q?.trim() ?? "";
  const role = normalizeRole(params.role);
  const status = normalizeStatus(params.status);
  const page = normalizeAdminPage(params.page);
  const skip = (page - 1) * pageSize;
  const prisma = getPrisma();
  const where = {
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" as const } },
            { username: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        status: true,
        emailVerified: true,
        availableBalance: true,
        pendingBalance: true,
        escrowBalance: true,
        createdAt: true,
        _count: {
          select: {
            tasks: true,
            submissions: true,
            withdrawals: true,
            depositIntents: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-[#00a650]">Anti-abuse</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#001b49]">Người dùng</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4a5568]">
            Tìm tài khoản, đổi vai trò, khóa tạm thời hoặc cấm tài khoản có dấu hiệu vi phạm.
          </p>
        </div>
      </header>

      <form className="grid gap-3 rounded-lg bg-white p-4 text-[#001b49] shadow-[0_2px_10px_rgba(0,0,0,0.06)] ring-1 ring-[#f0f2f5] lg:grid-cols-[1fr_180px_180px_120px]" method="get">
        <input
          className="h-10 bg-[#f5f7fa] px-3 text-sm outline-none ring-1 ring-transparent focus:ring-[#22ab59]"
          defaultValue={query}
          name="q"
          placeholder="Tìm theo email hoặc username"
        />
        <select
          className="h-10 bg-[#f5f7fa] px-3 text-sm font-bold outline-none ring-1 ring-transparent focus:ring-[#22ab59]"
          defaultValue={role ?? ""}
          name="role"
        >
          <option value="">Tất cả vai trò</option>
          {Object.values(UserRole).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          className="h-10 bg-[#f5f7fa] px-3 text-sm font-bold outline-none ring-1 ring-transparent focus:ring-[#22ab59]"
          defaultValue={status ?? ""}
          name="status"
        >
          <option value="">Tất cả trạng thái</option>
          {Object.values(UserStatus).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button className="h-10 rounded bg-emerald-500 px-4 text-sm font-bold text-white hover:bg-emerald-600">
          Tìm
        </button>
      </form>

      <section className="overflow-hidden rounded-lg bg-white text-[#001b49] shadow-[0_2px_10px_rgba(0,0,0,0.06)] ring-1 ring-[#f0f2f5]">
        <div className="border-b border-[#f0f2f5] px-5 py-4">
          <h2 className="font-semibold">{totalCount} tài khoản</h2>
        </div>

        {users.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[#686d77]">Không tìm thấy tài khoản phù hợp.</p>
        ) : (
          <div className="divide-y divide-[#f0f2f5]">
            {users.map((user) => (
              <article className="grid gap-6 px-5 py-6 xl:grid-cols-[1fr_420px] items-start" key={user.id}>
                <div className="space-y-6">
                  <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#686d77]">Tài khoản</p>
                      <p className="font-bold text-[#001b49] break-all">{user.email}</p>
                      <p className="text-sm text-[#4a5568]">{user.username ? `@${user.username}` : "Chưa có username"}</p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#686d77]">Phân quyền</p>
                      <div className="flex gap-2 items-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${user.role === "ADMIN" ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"}`}>
                          {user.role}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${user.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                          {user.status}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#686d77]">Số dư</p>
                      <div className="space-y-1">
                        <p className="text-sm flex justify-between text-[#4a5568]"><span>Khả dụng</span> <span className="font-medium text-[#001b49]">{formatVnd(user.availableBalance.toString())}</span></p>
                        <p className="text-sm flex justify-between text-[#4a5568]"><span>Pending</span> <span className="font-medium">{formatVnd(user.pendingBalance.toString())}</span></p>
                        <p className="text-sm flex justify-between text-[#4a5568]"><span>Ký quỹ</span> <span className="font-medium">{formatVnd(user.escrowBalance.toString())}</span></p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#686d77]">Hoạt động</p>
                      <div className="space-y-1">
                        <p className="text-sm flex justify-between text-[#4a5568]"><span>Task</span> <span className="font-medium">{user._count.tasks}</span></p>
                        <p className="text-sm flex justify-between text-[#4a5568]"><span>Submission</span> <span className="font-medium">{user._count.submissions}</span></p>
                        <p className="text-sm flex justify-between text-[#4a5568]"><span>Giao dịch</span> <span className="font-medium">{user._count.withdrawals + user._count.depositIntents}</span></p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg bg-[#f8f9fa] border border-[#e2e8f0] px-4 py-3 text-sm text-[#4a5568]">
                    <p className="flex items-center gap-2">
                      <span className="font-medium text-[#001b49]">Email:</span> 
                      {user.emailVerified ? (
                         <span className="text-green-600 font-medium">Đã xác minh</span>
                      ) : (
                         <span className="text-amber-600 font-medium">Chưa xác minh</span>
                      )}
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="font-medium text-[#001b49]">Ngày tạo:</span> {formatDate(user.createdAt)}
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="font-medium text-[#001b49]">ID:</span> <span className="font-mono text-xs">{user.id}</span>
                    </p>
                  </div>
                </div>

                <form action={updateUserManagementForm} className="grid gap-4 rounded-xl border border-[#e2e8f0] bg-[#f8f9fa] p-5 shadow-sm">
                  <input name="userId" type="hidden" value={user.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-sm font-semibold text-[#001b49]">
                      Vai trò
                      <select
                        className="h-9 rounded-md border border-[#d3dae6] bg-white px-3 text-sm font-medium outline-none transition-colors focus:border-[#22ab59] focus:ring-1 focus:ring-[#22ab59]"
                        defaultValue={user.role}
                        name="role"
                      >
                        {Object.values(UserRole).map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1.5 text-sm font-semibold text-[#001b49]">
                      Trạng thái
                      <select
                        className="h-9 rounded-md border border-[#d3dae6] bg-white px-3 text-sm font-medium outline-none transition-colors focus:border-[#22ab59] focus:ring-1 focus:ring-[#22ab59]"
                        defaultValue={user.status}
                        name="status"
                      >
                        {Object.values(UserStatus).map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-[#001b49]">Lý do cập nhật</label>
                    <textarea
                      className="min-h-20 w-full rounded-md border border-[#d3dae6] bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[#22ab59] focus:ring-1 focus:ring-[#22ab59]"
                      name="reason"
                      placeholder="Ghi chú audit log (bắt buộc)"
                      required
                    />
                  </div>
                  <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-[#001b49] px-4 text-sm font-medium text-white transition-colors hover:bg-[#001b49]/90">
                    <UserCog className="size-4" />
                    Cập nhật tài khoản
                  </button>
                  {user.status === UserStatus.ACTIVE && (
                    <div className="mt-1 flex items-start gap-2 rounded-md bg-red-50 p-2.5 text-xs leading-relaxed text-red-800">
                      <ShieldBan className="mt-0.5 size-4 shrink-0 text-red-600" />
                      <p>Khi chuyển trạng thái sang <strong>SUSPENDED</strong> hoặc <strong>BANNED</strong>, hệ thống tự động hủy các yêu cầu rút tiền đang chờ và chặn mọi thao tác.</p>
                    </div>
                  )}
                </form>
              </article>
            ))}
          </div>
        )}
        <AdminPagination
          basePath="/admin/users"
          page={page}
          pageSize={pageSize}
          params={{ q: query, role, status }}
          totalCount={totalCount}
        />
      </section>
    </div>
  );
}
