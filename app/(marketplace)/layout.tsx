import { ShieldCheck } from "lucide-react";
import { AppNavbar } from "@/components/layout/app-navbar";

export default function MarketplaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <AppNavbar />
      <main className="flex-1 bg-zinc-50">
        <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
          <div className="mb-4 flex items-start gap-3 rounded border border-amber-200 bg-amber-100 px-3 py-3 text-sm text-amber-900 sm:mb-6 sm:px-4">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
            <p>
              Bảo mật tài khoản: thêm email khôi phục để giữ quyền truy cập và không bị gián đoạn
              khi làm nhiệm vụ.
            </p>
          </div>

          <section className="overflow-hidden rounded border border-zinc-200 bg-white">
            {children}
          </section>
        </div>
      </main>
    </>
  );
}
