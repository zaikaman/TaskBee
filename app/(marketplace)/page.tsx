import Link from "next/link";
import { EyeOff, ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const demoTasks = [
  {
    title: "Đăng ký bằng Google và hoàn thành 1 khảo sát",
    reward: "18,000 VND",
    claimed: 190,
    total: 500,
    featured: true,
    accent: "border-l-violet-500",
  },
  {
    title: "Tải ứng dụng, xác minh KYC và gửi ảnh chụp màn hình",
    reward: "12,000 VND",
    claimed: 128,
    total: 1200,
    featured: true,
    accent: "border-l-violet-500",
  },
  {
    title: "YouTube: đăng ký kênh và bình luận theo yêu cầu",
    reward: "7,500 VND",
    claimed: 6,
    total: 62,
    featured: true,
    accent: "border-l-blue-500",
  },
];

export default function MarketplacePage() {
  return (
    <>
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <span className="text-sm text-slate-500">629 kết quả</span>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-center">
          <label className="relative block md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-9 w-full rounded border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
              placeholder="Tìm kiếm công việc..."
              type="search"
            />
          </label>
          <div className="flex items-center gap-2 whitespace-nowrap text-sm">
            <span className="text-slate-500">Sắp xếp theo</span>
            <Button variant="ghost" className="h-8 px-2 font-medium text-emerald-700">
              Mới nhất
            </Button>
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-200 bg-slate-50">
        {demoTasks.map((task) => {
          const progress = Math.round((task.claimed / task.total) * 100);

          return (
            <article
              key={task.title}
              className={`border-l-4 ${task.accent} bg-white p-4 transition-shadow hover:shadow-sm`}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 flex-1">
                  <Link
                    href="/tasks/demo"
                    className="flex flex-wrap items-center gap-2 text-base font-medium text-slate-900 hover:text-emerald-700"
                  >
                    {task.title}
                    {task.featured ? (
                      <span className="rounded bg-violet-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                        Nổi bật
                      </span>
                    ) : null}
                  </Link>
                  <p className="mt-2 text-xs text-slate-500">3 ngày xét duyệt</p>
                </div>

                <div className="flex items-center justify-between gap-6 md:gap-12">
                  <div className="w-36">
                    <div className="mb-1 text-xs text-slate-600">
                      {task.claimed} trong {task.total}
                    </div>
                    <div className="mb-1 text-xs text-slate-500">đã giữ vị trí</div>
                    <div className="h-1.5 rounded-full bg-slate-200">
                      <div
                        className={progress > 30 ? "h-1.5 rounded-full bg-red-400" : "h-1.5 rounded-full bg-emerald-500"}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="min-w-24 text-right">
                    <div className="mb-1 flex justify-end gap-2 text-slate-400">
                      <Button variant="ghost" size="icon" className="size-7" aria-label="Mở chi tiết">
                        <ExternalLink className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" aria-label="Ẩn việc">
                        <EyeOff className="size-4" />
                      </Button>
                    </div>
                    <div className="text-lg font-bold text-slate-900">{task.reward}</div>
                    <div className="text-xs text-slate-500">mỗi vị trí</div>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
