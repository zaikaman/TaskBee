import { ShieldCheck, SlidersHorizontal } from "lucide-react";
import { AppNavbar } from "@/components/layout/app-navbar";
import { Button } from "@/components/ui/button";
import { JobsDropdown } from "./jobs-dropdown";

const filters = ["Cấp độ", "Danh mục", "Danh mục con", "Thanh toán", "Vị trí", "Thống kê"];

export default function MarketplaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <AppNavbar />
      <main className="flex-1 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-start gap-3 rounded border border-amber-200 bg-amber-100 px-4 py-3 text-sm text-amber-900">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
            <p>
              Bảo mật tài khoản: thêm email khôi phục để giữ quyền truy cập và không bị gián đoạn
              khi làm nhiệm vụ.
            </p>
          </div>

          <section className="overflow-hidden rounded border border-slate-200 bg-white">
            <div className="flex items-end justify-between border-b border-slate-200 px-3 pt-3">
              <div className="flex gap-2">
                <JobsDropdown isActive={true} />
                <Button variant="ghost" className="rounded-b-none rounded-t text-slate-500">
                  Khảo sát
                </Button>
              </div>
              <Button variant="ghost" size="icon" aria-label="Bộ lọc">
                <SlidersHorizontal className="size-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-white p-3">
              {filters.map((filter, index) => (
                <Button
                  key={filter}
                  variant="outline"
                  className="h-9 flex-1 justify-between rounded text-sm text-slate-600 disabled:opacity-50 md:min-w-36"
                  disabled={index === 2}
                >
                  {filter}
                  <span aria-hidden="true">v</span>
                </Button>
              ))}
            </div>

            {children}
          </section>
        </div>
      </main>
    </>
  );
}
