import { ShieldBan, UserCog } from "lucide-react";
import { getPrisma } from "@/lib/db/prisma";
import { UserRole, UserStatus } from "@/lib/generated/prisma/client";
import { updateUserManagement } from "@/lib/services/admin";
import { formatVnd } from "@/lib/utils/money";

export const dynamic = "force-dynamic";

type UsersPageProps = {
  searchParams?: Promise<{
    q?: string;
    role?: string;
    status?: string;
  }>;
};

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
  const prisma = getPrisma();
  const users = await prisma.user.findMany({
    where: {
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
      ...(query
        ? {
            OR: [
              { email: { contains: query, mode: "insensitive" } },
              { username: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
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
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-[#00a650]">Anti-abuse</p>
          <h1 className="mt-2 text-3xl font-black tracking-normal text-[#001b49]">Người dùng</h1>
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
          <h2 className="font-bold">{users.length} tài khoản</h2>
        </div>

        {users.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[#686d77]">Không tìm thấy tài khoản phù hợp.</p>
        ) : (
          <div className="divide-y divide-[#f0f2f5]">
            {users.map((user) => (
              <article className="grid gap-5 px-5 py-5 xl:grid-cols-[1fr_420px]" key={user.id}>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-xs font-bold uppercase text-[#686d77]">Tài khoản</p>
                      <p className="mt-1 font-bold">{user.email}</p>
                      <p className="mt-1 text-sm text-[#686d77]">{user.username ?? "Chưa có username"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-[#686d77]">Phân quyền</p>
                      <p className="mt-1 font-bold">{user.role}</p>
                      <p className="mt-1 text-sm text-[#686d77]">Trạng thái: {user.status}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-[#686d77]">Số dư</p>
                      <p className="mt-1 text-sm text-[#4a5568]">Khả dụng {formatVnd(user.availableBalance.toString())}</p>
                      <p className="mt-1 text-sm text-[#4a5568]">Pending {formatVnd(user.pendingBalance.toString())}</p>
                      <p className="mt-1 text-sm text-[#4a5568]">Ký quỹ {formatVnd(user.escrowBalance.toString())}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-[#686d77]">Hoạt động</p>
                      <p className="mt-1 text-sm text-[#4a5568]">{user._count.tasks} task · {user._count.submissions} submission</p>
                      <p className="mt-1 text-sm text-[#4a5568]">{user._count.withdrawals} rút tiền · {user._count.depositIntents} nạp tiền</p>
                    </div>
                  </div>
                  <div className="grid gap-3 rounded bg-[#f5f7fa] p-4 text-sm md:grid-cols-3">
                    <p>
                      <span className="font-bold">Email xác minh:</span> {user.emailVerified ? "Đã xác minh" : "Chưa xác minh"}
                    </p>
                    <p>
                      <span className="font-bold">Ngày tạo:</span> {formatDate(user.createdAt)}
                    </p>
                    <p>
                      <span className="font-bold">User ID:</span> {user.id}
                    </p>
                  </div>
                </div>

                <form action={updateUserManagementForm} className="grid gap-3 rounded bg-[#f5f7fa] p-4">
                  <input name="userId" type="hidden" value={user.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-bold">
                      Vai trò
                      <select
                        className="h-10 bg-white px-3 font-medium outline-none ring-1 ring-[#d3dae6] focus:ring-[#22ab59]"
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
                    <label className="grid gap-2 text-sm font-bold">
                      Trạng thái
                      <select
                        className="h-10 bg-white px-3 font-medium outline-none ring-1 ring-[#d3dae6] focus:ring-[#22ab59]"
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
                  <textarea
                    className="min-h-24 bg-white px-3 py-2 text-sm outline-none ring-1 ring-[#d3dae6] focus:ring-[#22ab59]"
                    name="reason"
                    placeholder="Lý do cập nhật để ghi audit log"
                    required
                  />
                  <button className="inline-flex h-10 items-center justify-center gap-2 rounded bg-emerald-500 px-4 text-sm font-bold text-white hover:bg-emerald-600">
                    <UserCog className="size-4" />
                    Cập nhật tài khoản
                  </button>
                  {user.status === UserStatus.ACTIVE ? (
                    <p className="inline-flex items-start gap-2 text-xs leading-5 text-[#686d77]">
                      <ShieldBan className="mt-0.5 size-4 shrink-0 text-[#e63e46]" />
                      Khi chuyển sang SUSPENDED hoặc BANNED, hệ thống tự hủy withdrawal đang chờ và chặn action yêu cầu tài khoản ACTIVE.
                    </p>
                  ) : null}
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
