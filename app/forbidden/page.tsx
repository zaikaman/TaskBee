import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";

function getBackHref(role?: string | null) {
  if (role === "EMPLOYER") {
    return "/dashboard/employer/tasks";
  }

  if (role === "WORKER") {
    return "/marketplace";
  }

  return "/login";
}

export default async function ForbiddenPage() {
  const session = await getCurrentUser();
  const backHref = getBackHref(session?.profile?.role);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <section className="w-full max-w-lg bg-white p-8 text-center shadow-sm ring-1 ring-zinc-100">
        <div className="mx-auto flex size-14 items-center justify-center rounded bg-red-50 text-red-600">
          <ShieldAlert className="size-7" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-zinc-950">Không có quyền truy cập</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Tài khoản của bạn không có vai trò phù hợp để mở khu vực này.
        </p>
        <Button asChild className="mt-6 rounded bg-emerald-600 text-white hover:bg-emerald-700">
          <Link href={backHref}>{session?.profile?.role === "EMPLOYER" ? "Về dashboard công việc" : session?.profile?.role === "WORKER" ? "Về trang việc làm" : "Về trang đăng nhập"}</Link>
        </Button>
      </section>
    </main>
  );
}
