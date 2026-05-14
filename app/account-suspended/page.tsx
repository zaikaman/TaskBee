import Link from "next/link";
import { CircleOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AccountSuspendedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="w-full max-w-lg bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
        <div className="mx-auto flex size-14 items-center justify-center rounded bg-amber-50 text-amber-700">
          <CircleOff className="size-7" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-bold text-slate-950">Tài khoản đang bị hạn chế</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Tài khoản của bạn đang bị tạm khóa hoặc bị cấm nên không thể sử dụng các tính năng cần
          xác minh.
        </p>
        <Button asChild className="mt-6 rounded bg-emerald-600 text-white hover:bg-emerald-700">
          <Link href="/support">Liên hệ hỗ trợ</Link>
        </Button>
      </section>
    </main>
  );
}
