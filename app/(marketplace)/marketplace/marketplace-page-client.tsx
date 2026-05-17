"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import posthog from "posthog-js";
import {
  ChevronDown,
  EyeOff,
  ExternalLink,
  Grid2X2,
  List,
  Lock,
  Rows3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JobsDropdown } from "../jobs-dropdown";
import { formatVnd } from "@/lib/utils/money";
import type { MarketplaceTaskListItem } from "@/lib/services/marketplace";
import type { TaskFilterInput } from "@/lib/validators/task";

type MarketplacePageClientProps = {
  tasks: MarketplaceTaskListItem[];
  categories?: string[];
  filters: TaskFilterInput;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

type FilterPanelKey = "level" | "category" | "subcategory" | "payment" | "stats";

type FilterOption = {
  label: string;
  locked?: boolean;
};

const taskLevels: FilterOption[] = [
  { label: "Người mới" },
  { label: "Nâng cao", locked: true },
  { label: "Chuyên gia", locked: true },
];

const fallbackCategories = [
  "Việc nhanh",
  "Đăng ký tài khoản",
  "SEO, nội dung và tương tác",
  "Nhập liệu và thu thập dữ liệu",
  "Telegram",
  "Discord",
];

const subcategories = [
  "Tải ứng dụng",
  "Theo dõi kênh",
  "Đăng bài",
  "Đánh giá sản phẩm",
  "Tham gia cộng đồng",
];

const employerStats = [
  "Việc thành công - thấp đến cao",
  "Việc thành công - cao đến thấp",
  "% nhiệm vụ hài lòng - thấp đến cao",
  "% nhiệm vụ hài lòng - cao đến thấp",
];

const sortOptions = [
  "Mới nhất",
  "Trả thưởng cao nhất",
  "Tài khoản đã xác minh",
  "Thời gian hoàn thành",
  "Người thuê được theo dõi",
];

function firstPageHref() {
  return "/marketplace";
}

function buildPageHref(filters: TaskFilterInput, page: number) {
  const query = new URLSearchParams();

  if (filters.search) {
    query.set("search", filters.search);
  }

  if (filters.category) {
    query.set("category", filters.category);
  }

  if (filters.status) {
    query.set("status", filters.status);
  }

  if (filters.minReward !== undefined) {
    query.set("minReward", String(filters.minReward));
  }

  if (filters.maxReward !== undefined) {
    query.set("maxReward", String(filters.maxReward));
  }

  query.set("page", String(page));

  const queryString = query.toString();

  return queryString.length > 0 ? `${firstPageHref()}?${queryString}` : firstPageHref();
}

function buildVisiblePages(page: number, totalPages: number) {
  const pageSet = new Set<number>();

  pageSet.add(1);
  pageSet.add(totalPages);

  for (let offset = -2; offset <= 2; offset += 1) {
    const candidate = page + offset;

    if (candidate >= 1 && candidate <= totalPages) {
      pageSet.add(candidate);
    }
  }

  return Array.from(pageSet).sort((left, right) => left - right);
}

function HiddenFilterFields({
  filters,
  pageSize,
  omit = [],
}: {
  filters: TaskFilterInput;
  pageSize: number;
  omit?: Array<"search" | "category" | "minReward" | "maxReward">;
}) {
  return (
    <>
      <input type="hidden" name="page" value="1" />
      <input type="hidden" name="pageSize" value={String(pageSize)} />
      {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
      {filters.search && !omit.includes("search") ? (
        <input type="hidden" name="search" value={filters.search} />
      ) : null}
      {filters.category && !omit.includes("category") ? (
        <input type="hidden" name="category" value={filters.category} />
      ) : null}
      {filters.minReward !== undefined && !omit.includes("minReward") ? (
        <input type="hidden" name="minReward" value={String(filters.minReward)} />
      ) : null}
      {filters.maxReward !== undefined && !omit.includes("maxReward") ? (
        <input type="hidden" name="maxReward" value={String(filters.maxReward)} />
      ) : null}
    </>
  );
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={active}
      onClick={onClick}
      className="flex w-full h-12 min-w-36 flex-1 items-center justify-between border-r border-[#dfe6ef] bg-[#f5f7fa] px-5 text-sm font-semibold text-[#566174] transition-colors hover:bg-white sm:min-w-40"
    >
      <span className="truncate">{label}</span>
      <ChevronDown className={`size-4 text-[#6d7480] transition-transform ${active ? "rotate-180" : ""}`} />
    </button>
  );
}

function OptionRow({
  option,
  type = "checkbox",
  name,
}: {
  option: FilterOption;
  type?: "checkbox" | "radio";
  name?: string;
}) {
  const isRadio = type === "radio";

  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-[#687282]">
      <input
        type={type}
        name={name}
        value={option.label}
        disabled={option.locked}
        className={`size-3.5 appearance-none border bg-white checked:border-[#22ab59] checked:bg-[#22ab59] disabled:opacity-60 ${
          isRadio ? "rounded-full border-[#c7d3e2]" : "rounded-sm border-[#202733]"
        }`}
      />
      <span className="flex items-center gap-1.5">
        {option.label}
        {option.locked ? <Lock className="size-3.5 text-[#687282]" aria-hidden="true" /> : null}
      </span>
    </label>
  );
}

function PanelShell({
  children,
  footer,
  wide,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`absolute left-0 top-full z-40 mt-2 border border-[#edf0f4] bg-white shadow-[0_12px_28px_rgba(20,28,38,0.13)] ${
        wide ? "w-[340px] sm:w-[470px]" : "w-[320px]"
      }`}
    >
      <div className="p-6">{children}</div>
      <div className="grid grid-cols-2 bg-[#f5f7fa] text-sm font-bold uppercase">
        {footer}
      </div>
    </div>
  );
}

function MarketplaceFilterPanel({
  activePanel,
  categories,
  filters,
  pageSize,
}: {
  activePanel: FilterPanelKey;
  categories: string[];
  filters: TaskFilterInput;
  pageSize: number;
}) {
  if (activePanel === "level") {
    return (
      <PanelShell
        footer={
          <>
            <button type="button" className="h-10 text-[#22ab59]">
              Xóa lọc
            </button>
            <button type="button" className="h-10 bg-[#22ab59] text-white">
              Áp dụng
            </button>
          </>
        }
      >
        <div className="space-y-4">{taskLevels.map((option) => <OptionRow key={option.label} option={option} />)}</div>
      </PanelShell>
    );
  }

  if (activePanel === "category") {
    return (
      <form action="/marketplace" method="get">
        <PanelShell
          footer={
            <>
              <Link
                href={buildPageHref({ ...filters, category: undefined }, 1)}
                className="flex h-10 items-center justify-center text-[#22ab59]"
              >
                Xóa lọc
              </Link>
              <button type="submit" className="h-10 bg-[#22ab59] text-white">
                Áp dụng
              </button>
            </>
          }
        >
          <HiddenFilterFields filters={filters} pageSize={pageSize} omit={["category"]} />
          <div className="space-y-4">
            {categories.map((category) => (
              <label key={category} className="flex cursor-pointer items-center gap-3 text-sm text-[#687282]">
                <input
                  type="radio"
                  name="category"
                  value={category}
                  defaultChecked={filters.category === category}
                  className="size-3.5 appearance-none rounded-full border border-[#c7d3e2] bg-white checked:border-[#22ab59] checked:bg-[#22ab59]"
                />
                <span>{category}</span>
              </label>
            ))}
          </div>
        </PanelShell>
      </form>
    );
  }

  if (activePanel === "subcategory") {
    return (
      <PanelShell
        footer={
          <>
            <button type="button" className="h-10 text-[#22ab59]">
              Xóa lọc
            </button>
            <button type="button" className="h-10 bg-[#22ab59] text-white">
              Áp dụng
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {subcategories.map((label) => (
            <OptionRow key={label} name="marketplace-subcategory" option={{ label }} type="radio" />
          ))}
        </div>
      </PanelShell>
    );
  }

  if (activePanel === "payment") {
    return (
      <form action="/marketplace" method="get">
        <PanelShell
          footer={
            <>
              <Link
                href={buildPageHref({ ...filters, minReward: undefined, maxReward: undefined }, 1)}
                className="flex h-10 items-center justify-center text-[#22ab59]"
              >
                Xóa lọc
              </Link>
              <button type="submit" className="h-10 bg-[#22ab59] text-white">
                Áp dụng
              </button>
            </>
          }
        >
          <HiddenFilterFields filters={filters} pageSize={pageSize} omit={["minReward", "maxReward"]} />
          <div className="space-y-4">
            <p className="text-sm font-semibold text-[#202733]">Khoảng thưởng</p>
            <div className="flex items-center gap-3">
              <Input
                name="minReward"
                inputMode="numeric"
                defaultValue={filters.minReward ?? ""}
                placeholder="Tối thiểu"
                className="h-10 rounded-none border-[#cbd6e3] text-center text-sm"
              />
              <span className="text-[#687282]">-</span>
              <Input
                name="maxReward"
                inputMode="numeric"
                defaultValue={filters.maxReward ?? ""}
                placeholder="Tối đa"
                className="h-10 rounded-none border-[#cbd6e3] text-center text-sm"
              />
            </div>
            <div className="relative h-4">
              <div className="absolute left-1 right-1 top-1/2 h-px bg-[#22ab59]" />
              <div className="absolute left-0 top-1/2 size-3 -translate-y-1/2 rounded-full border border-[#22ab59] bg-white" />
              <div className="absolute right-0 top-1/2 size-3 -translate-y-1/2 rounded-full border border-[#22ab59] bg-white" />
            </div>
          </div>
        </PanelShell>
      </form>
    );
  }

  return (
    <PanelShell
      footer={
        <>
          <button type="button" className="h-10 text-[#22ab59]">
            Xóa lọc
          </button>
          <button type="button" className="h-10 bg-[#22ab59] text-white">
            Áp dụng
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {employerStats.map((label) => (
          <OptionRow key={label} name="marketplace-stats" option={{ label }} type="radio" />
        ))}
      </div>
    </PanelShell>
  );
}

function SortMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 whitespace-nowrap text-sm font-bold text-[#203259]"
      >
        Sắp xếp theo
        <span className="text-[#22ab59]">/ Mới nhất</span>
        <ChevronDown className={`size-3 text-[#9aa3b1] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-40 mt-3 w-64 border border-[#edf0f4] bg-white py-1 shadow-[0_12px_28px_rgba(20,28,38,0.13)]">
          {sortOptions.map((option, index) => (
            <button
              key={option}
              type="button"
              onClick={() => setOpen(false)}
              className={`block w-full px-5 py-3 text-left text-sm ${
                index === 0 ? "font-bold text-[#22ab59]" : "text-[#687282] hover:text-[#203259]"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MarketplacePageClient({
  tasks,
  categories: rawCategories,
  filters,
  page,
  pageSize,
  totalCount,
  totalPages,
}: MarketplacePageClientProps) {
  const [activePanel, setActivePanel] = useState<FilterPanelKey | null>(null);

  useEffect(() => {
    posthog.capture("task_listing_viewed", {
      total_count: totalCount,
      visible_count: tasks.length,
      page,
      page_size: pageSize,
      status: filters.status,
    });
  }, [filters.status, page, pageSize, tasks.length, totalCount]);

  const categories = useMemo(() => {
    const normalizedCategories = (rawCategories ?? []).filter((category) => category.trim().length > 0);

    return normalizedCategories.length > 0 ? normalizedCategories : fallbackCategories;
  }, [rawCategories]);

  const visiblePages = totalPages > 1 ? buildVisiblePages(page, totalPages) : [];
  const firstItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, totalCount);

  const togglePanel = (panel: FilterPanelKey) => {
    setActivePanel((current) => (current === panel ? null : panel));
  };

  return (
    <div className="text-[#1b1b1b]">
      <div className="mb-4 flex items-end justify-between border-b border-[#22ab59]">
        <JobsDropdown />
        <div className="flex items-center gap-3 pb-2 text-[#aab2c0]" aria-label="Kiểu hiển thị">
          <Grid2X2 className="size-4" />
          <List className="size-4 text-[#203259]" />
          <Rows3 className="size-4" />
        </div>
      </div>

      <div className="rounded border border-zinc-200 bg-white">
        <div className="relative border-b border-[#edf0f4] bg-[#f5f7fa] px-0 rounded-t">
        <div className="flex flex-wrap min-h-12 w-full">
          <div className="relative flex-1 min-w-[20%]">
            <FilterButton active={activePanel === "level"} label="Cấp độ việc" onClick={() => togglePanel("level")} />
            {activePanel === "level" ? (
              <MarketplaceFilterPanel activePanel="level" categories={categories} filters={filters} pageSize={pageSize} />
            ) : null}
          </div>
          <div className="relative flex-1 min-w-[20%]">
            <FilterButton active={activePanel === "category"} label="Danh mục" onClick={() => togglePanel("category")} />
            {activePanel === "category" ? (
              <MarketplaceFilterPanel activePanel="category" categories={categories} filters={filters} pageSize={pageSize} />
            ) : null}
          </div>
          <div className="relative flex-1 min-w-[20%]">
            <FilterButton active={activePanel === "subcategory"} label="Danh mục con" onClick={() => togglePanel("subcategory")} />
            {activePanel === "subcategory" ? (
              <MarketplaceFilterPanel activePanel="subcategory" categories={categories} filters={filters} pageSize={pageSize} />
            ) : null}
          </div>
          <div className="relative flex-1 min-w-[20%]">
            <FilterButton active={activePanel === "payment"} label="Thanh toán" onClick={() => togglePanel("payment")} />
            {activePanel === "payment" ? (
              <MarketplaceFilterPanel activePanel="payment" categories={categories} filters={filters} pageSize={pageSize} />
            ) : null}
          </div>
          <div className="relative flex-1 min-w-[20%]">
            <FilterButton active={activePanel === "stats"} label="Thống kê thuê" onClick={() => togglePanel("stats")} />
            {activePanel === "stats" ? (
              <MarketplaceFilterPanel activePanel="stats" categories={categories} filters={filters} pageSize={pageSize} />
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 py-5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-[#1b1b1b]">{totalCount.toLocaleString("vi-VN")} kết quả</p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <form
            action="/marketplace"
            method="get"
            onSubmit={(event) => {
              const formData = new FormData(event.currentTarget);

              posthog.capture("marketplace_filters_applied", {
                search: String(formData.get("search") ?? ""),
              });
            }}
          >
            <HiddenFilterFields filters={filters} pageSize={pageSize} omit={["search"]} />
            <Input
              defaultValue={filters.search ?? ""}
              name="search"
              placeholder="Tìm việc và nhấn Enter..."
              className="h-10 w-full rounded-none border-0 bg-[#f5f7fa] px-3 text-sm text-[#203259] shadow-none placeholder:text-[#203259] focus-visible:ring-1 focus-visible:ring-[#22ab59] sm:w-64"
            />
          </form>
          <SortMenu />
        </div>
      </div>

      <div className="border-t border-[#edf0f4]">
        {tasks.length > 0 ? (
          tasks.map((task) => {
            const remainingSlots = Math.max(task.totalSlots - task.claimedSlots, 0);
            const progress = task.totalSlots > 0 ? Math.round((task.claimedSlots / task.totalSlots) * 100) : 0;
            const progressWidth = `${Math.min(progress, 100)}%`;

            return (
              <article
                key={task.id}
                className="group grid gap-4 border-b border-[#edf0f4] border-l-2 border-l-[#6f3cff] bg-[#fbf9ff] px-4 py-5 transition-colors hover:bg-white sm:px-8 lg:grid-cols-[minmax(0,1fr)_180px_130px]"
              >
                <div className="min-w-0">
                  <h3 className="mb-5 line-clamp-2 text-base font-semibold text-[#203259] group-hover:text-[#22ab59]">
                    <Link href={`/marketplace/${task.id}`} className="hover:underline">
                      {task.title}
                    </Link>
                    <span className="ml-2 inline-flex rounded-sm bg-[#7f35ff] px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase text-white">
                      nổi bật
                    </span>
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-[#687282]">
                    <span className="inline-flex items-center gap-1">
                      <span className="rounded-sm bg-[#dff5e7] px-1 text-[10px] font-bold uppercase text-[#22ab59]">QT</span>
                      Quốc tế
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="rounded-sm bg-[#dff5e7] px-1 text-[10px] font-bold text-[#22ab59]">i</span>
                      {task.category ?? "Việc nhỏ"}
                    </span>
                    <span>Người mới</span>
                  </div>
                </div>

                <div className="self-center">
                  <p className="text-sm font-bold text-[#1b1b1b]">
                    {remainingSlots.toLocaleString("vi-VN")} trong {task.totalSlots.toLocaleString("vi-VN")}
                  </p>
                  <p className="mt-1 text-sm text-[#1b1b1b]">còn lại</p>
                  <div className="mt-4 h-1.5 w-full max-w-32 rounded-full bg-[#dfe6ef]">
                    <div className="h-1.5 rounded-full bg-[#22ab59]" style={{ width: progressWidth }} />
                  </div>
                </div>

                <div className="flex items-end justify-between gap-4 lg:flex-col lg:items-end">
                  <div className="flex items-center gap-2 text-[#687282]">
                    <Button asChild variant="ghost" size="icon" className="size-7 rounded-none text-[#687282] hover:text-[#203259]">
                      <Link href={`/marketplace/${task.id}`} aria-label="Mở chi tiết việc">
                        <ExternalLink className="size-4" />
                      </Link>
                    </Button>
                    <button type="button" className="size-7 text-[#687282] hover:text-[#203259]" aria-label="Ẩn việc này">
                      <EyeOff className="size-4" />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[#1b1b1b]">{formatVnd(task.rewardAmount)}</p>
                    <p className="text-xs text-[#687282]">mỗi nhiệm vụ</p>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="px-6 py-12 text-center text-sm text-[#687282]">Không tìm thấy việc phù hợp.</div>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#687282]">
            Đang hiển thị {firstItem.toLocaleString("vi-VN")}-{lastItem.toLocaleString("vi-VN")} trên{" "}
            {totalCount.toLocaleString("vi-VN")} kết quả
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {page <= 1 ? (
              <Button type="button" variant="outline" size="sm" disabled className="h-9 rounded-none border-[#dfe6ef] bg-white px-3">
                Trước
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className="h-9 rounded-none border-[#dfe6ef] bg-white px-3">
                <Link href={buildPageHref(filters, page - 1)}>Trước</Link>
              </Button>
            )}

            {visiblePages.map((visiblePage, index) => {
              const previousPage = visiblePages[index - 1];
              const shouldShowGap = previousPage !== undefined && visiblePage - previousPage > 1;

              return (
                <div key={visiblePage} className="flex items-center gap-2">
                  {shouldShowGap ? <span className="px-1 text-[#aab2c0]">...</span> : null}
                  <Button
                    type="button"
                    size="sm"
                    className={
                      visiblePage === page
                        ? "h-9 min-w-9 rounded-none bg-[#22ab59] px-3 text-white hover:bg-[#1d934c]"
                        : "h-9 min-w-9 rounded-none border border-[#dfe6ef] bg-white px-3 text-[#687282] hover:bg-[#f5f7fa]"
                    }
                    asChild={visiblePage !== page}
                    variant={visiblePage === page ? "default" : "outline"}
                  >
                    {visiblePage === page ? (
                      <span>{visiblePage}</span>
                    ) : (
                      <Link href={buildPageHref(filters, visiblePage)}>{visiblePage}</Link>
                    )}
                  </Button>
                </div>
              );
            })}

            {page >= totalPages ? (
              <Button type="button" variant="outline" size="sm" disabled className="h-9 rounded-none border-[#dfe6ef] bg-white px-3">
                Sau
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className="h-9 rounded-none border-[#dfe6ef] bg-white px-3">
                <Link href={buildPageHref(filters, page + 1)}>Sau</Link>
              </Button>
            )}
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
