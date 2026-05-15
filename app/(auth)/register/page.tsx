import Link from "next/link";
import { redirect } from "next/navigation";
import { Leaf } from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";
import { getCurrentUser } from "@/lib/auth/session";
import { RegisterOtpForm } from "./register-otp-form";

export default async function RegisterPage() {
  const session = await getCurrentUser();

  if (session) {
    // Redirect based on role if already logged in
    const userRole = session.profile?.role;
    if (userRole === "EMPLOYER") {
      redirect("/dashboard/employer/tasks");
    } else if (userRole === "ADMIN") {
      redirect("/dashboard/admin");
    } else {
      redirect("/marketplace");
    }
  }

  return (
    <div className="home min-h-screen bg-white">
      <header className="mx-auto flex h-[86px] max-w-[1090px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-[#22ab59]">
          <span className="flex size-9 items-center justify-center rounded-full border-2 border-[#22ab59]">
            <Leaf className="size-5" aria-hidden="true" />
          </span>
          <span className="text-xl font-bold text-[#22ab59]">TaskBee</span>
        </Link>

        <nav className="hidden items-center gap-14 text-sm font-bold text-[#203259] md:flex">
          <Link href="/marketplace" className="hover:text-[#22ab59]">
            Khám phá việc
          </Link>
          <Link href="/referrals" className="hover:text-[#22ab59]">
            Chương trình giới thiệu
          </Link>
        </nav>

        <div className="flex items-center gap-7 text-sm font-medium">
          <Link href="/login" className="text-[#22ab59] hover:text-[#005924]">
            Đăng nhập
          </Link>
          <Link
            href="/register"
            className="rounded-[3px] bg-[#22ab59] px-6 py-3 font-bold text-white shadow-sm hover:bg-[#005924]"
          >
            Đăng ký
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1090px] justify-center px-6 pb-20 pt-16">
        <section className="w-full max-w-[400px]">
          <RegisterOtpForm />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
