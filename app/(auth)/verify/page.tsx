import Link from "next/link";
import { redirect } from "next/navigation";
import { Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";

export default async function VerifyPage() {
  const session = await getCurrentUser();

  if (!session) {
    redirect("/login");
  }

  if (session.emailVerified && session.profile?.emailVerified) {
    redirect("/marketplace");
  }

  return (
    <div className="min-h-screen bg-white text-[#1b1b1b]">
      <header className="mx-auto flex h-[86px] max-w-[1090px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-[#22ab59]">
          <span className="flex size-9 items-center justify-center rounded-full border-2 border-[#22ab59]">
            <Leaf className="size-5" aria-hidden="true" />
          </span>
          <span className="text-xl font-bold text-[#22ab59]">TaskBee</span>
        </Link>
      </header>

      <main className="mx-auto flex max-w-[1090px] justify-center px-6 py-20">
        <section className="w-full max-w-xl space-y-4 bg-white p-8 shadow-sm ring-1 ring-slate-100">
          <h1 className="text-2xl font-bold text-slate-950">Xác minh email</h1>
          <p className="text-sm leading-6 text-slate-600">
            Tài khoản của bạn chưa được xác minh đầy đủ. Vui lòng kiểm tra email và hoàn tất bước
            xác minh để tiếp tục vào Marketplace, Dashboard và các tính năng theo vai trò.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild className="rounded bg-emerald-600 text-white hover:bg-emerald-700">
              <Link href="/login">Về trang đăng nhập</Link>
            </Button>
            <Button asChild variant="outline" className="rounded">
              <Link href="/marketplace">Xem trang công khai</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
