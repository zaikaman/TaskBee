import Link from "next/link";
import { Leaf } from "lucide-react";
import { SiteFooter } from "@/components/layout/site-footer";
import { LoginOtpForm } from "./login-otp-form";

type LoginPageProps = {
  searchParams?: Promise<{
    redirectTo?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectTo = params?.redirectTo ?? "/viec-lam";

  return (
    <div className="min-h-screen bg-white text-[#1b1b1b]">
      <header className="mx-auto flex h-[86px] max-w-[1090px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-[#22ab59]">
          <span className="flex size-9 items-center justify-center rounded-full border-2 border-[#22ab59]">
            <Leaf className="size-5" aria-hidden="true" />
          </span>
          <span className="text-xl font-bold text-[#22ab59]">TaskBee</span>
        </Link>

        <nav className="hidden items-center gap-14 text-sm font-bold text-[#203259] md:flex">
          <Link href="/viec-lam" className="hover:text-[#22ab59]">
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

      <main className="mx-auto flex max-w-[1090px] justify-center px-6 pb-24 pt-16">
        <section className="w-full max-w-[400px]">
          <LoginOtpForm redirectTo={redirectTo} />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
