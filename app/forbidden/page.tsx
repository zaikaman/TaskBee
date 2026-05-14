import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="w-full max-w-lg bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
        <div className="mx-auto flex size-14 items-center justify-center rounded bg-red-50 text-red-600">
          <ShieldAlert className="size-7" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-bold text-slate-950">Không có quyền truy cập</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Tài khoản của bạn không có vai trò phù hợp để mở khu vực này.
        </p>
        <Button asChild className="mt-6 rounded bg-emerald-600 text-white hover:bg-emerald-700">
          <Link href="/viec-lam">Về trang việc làm</Link>
        </Button>
      </section>
    </main>
  );
}
