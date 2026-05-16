"use client";

import { useEffect } from "react";
import Link from "next/link";
import posthog from "posthog-js";
import { ExternalLink, SlidersHorizontal } from "lucide-react";
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

export function MarketplacePageClient({
  tasks,
  filters,
  page,
  pageSize,
  totalCount,
  totalPages,
}: MarketplacePageClientProps) {
  useEffect(() => {
    posthog.capture("task_listing_viewed", {
      total_count: totalCount,
      visible_count: tasks.length,
      page,
      page_size: pageSize,
      status: filters.status,
    });
  }, [filters.status, page, pageSize, tasks.length, totalCount]);

  const visiblePages = totalPages > 1 ? buildVisiblePages(page, totalPages) : [];

  return (
    <div className="space-y-6 bg-zinc-50">
      <div className="flex flex-col items-center justify-between border-b border-zinc-200 bg-white p-4 text-sm md:flex-row">
        <div className="mb-4 flex w-full items-center gap-6 md:mb-0 md:w-auto">
          <JobsDropdown />
          <span className="text-zinc-500 whitespace-nowrap">{totalCount} kết quả</span>
        </div>
        
        <form
          action="/marketplace"
          method="get"
          onSubmit={(event) => {
            const formData = new FormData(event.currentTarget);

            posthog.capture("marketplace_filters_applied", {
              search: String(formData.get("search") ?? ""),
            });
          }}
          className="flex w-full items-center justify-between gap-4 md:w-auto md:justify-end"
        >
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={String(pageSize)} />

          <Button type="button" variant="outline" className="flex items-center gap-2 text-sm text-zinc-700 md:hidden">
            <SlidersHorizontal className="size-4" />
            Lọc
          </Button>

          <Input
            defaultValue={filters.search ?? ""}
            name="search"
            placeholder="Tìm kiếm công việc..."
            className="w-full rounded border-zinc-300 px-3 py-1.5 text-sm focus:border-sprout-green focus:ring-sprout-green md:w-64"
          />

          <Button type="button" variant="outline" className="hidden items-center gap-2 text-sm text-zinc-700 md:flex">
            <SlidersHorizontal className="size-4" />
            Lọc
          </Button>

          <div className="hidden items-center gap-2 whitespace-nowrap md:flex">
            <span className="text-zinc-500">Sắp xếp theo</span>
            <button type="button" className="flex items-center gap-1 font-medium text-sprout-green hover:text-green-700">
              Mới nhất
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-b bg-zinc-50">
        {tasks.length > 0 ? (
          tasks.map((task) => {
            const progress = task.totalSlots > 0 ? Math.round((task.claimedSlots / task.totalSlots) * 100) : 0;
            const progressWidth = `${Math.min(progress, 100)}%`;
            return (
              <div
                key={task.id}
                className="group flex flex-col items-center justify-between gap-4 border-b border-zinc-200 border-l-4 border-l-transparent bg-white p-4 transition-all hover:border-l-sprout-green hover:shadow-md md:flex-row"
              >
                <div className="w-full flex-1">
                  <h3 className="mb-2 flex cursor-pointer items-center gap-2 text-base font-medium text-sprout-dark group-hover:text-sprout-green">
                    <Link href={`/marketplace/${task.id}`} className="hover:underline">
                      {task.title}
                    </Link>
                    <span className="rounded bg-purple-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">NỔI BẬT</span>
                  </h3>
                  <div className="flex items-center gap-4 text-xs text-zinc-500">{task.autoApproveDays} ngày xét duyệt</div>
                </div>
                <div className="flex w-full items-center justify-between text-sm md:w-auto md:gap-12">
                  <div className="w-32">
                    <div className="mb-1 text-xs text-zinc-600">
                      {task.claimedSlots.toLocaleString("vi-VN")} trong {task.totalSlots.toLocaleString("vi-VN")}
                    </div>
                    <div className="mb-1 text-xs text-zinc-500">đã giữ vị trí</div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-200">
                      <div
                        className="h-1.5 rounded-full bg-sprout-green"
                        style={{ width: progressWidth }}
                      />
                    </div>
                  </div>
                  <div className="min-w-[80px] text-right">
                    <div className="mb-1 flex justify-end gap-2 text-zinc-400">
                      <Button asChild variant="ghost" size="icon" className="size-6 text-zinc-400 hover:text-sprout-dark">
                        <Link href={`/marketplace/${task.id}`}>
                          <ExternalLink className="size-4" />
                        </Link>
                      </Button>
                    </div>
                    <div className="text-lg font-bold text-sprout-dark">{formatVnd(task.rewardAmount)}</div>
                    <div className="text-xs text-zinc-500">mỗi vị trí</div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="px-6 py-12 text-center text-sm text-zinc-500">
            Không tìm thấy công việc phù hợp
          </div>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-col gap-4 px-4 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-500">
            Trang {page.toLocaleString("vi-VN")} / {totalPages.toLocaleString("vi-VN")}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {page <= 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                className="h-9 border-zinc-300 bg-white px-3"
              >
                Trước
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className="h-9 border-zinc-300 bg-white px-3">
                <Link href={buildPageHref(filters, page - 1)}>Trước</Link>
              </Button>
            )}

            {visiblePages.map((visiblePage, index) => {
              const previousPage = visiblePages[index - 1];
              const shouldShowGap = previousPage !== undefined && visiblePage - previousPage > 1;

              return (
                <div key={visiblePage} className="flex items-center gap-2">
                  {shouldShowGap ? <span className="px-1 text-zinc-400">…</span> : null}
                  <Button
                    type="button"
                    size="sm"
                    className={
                      visiblePage === page
                        ? "h-9 min-w-9 bg-sprout-green px-3 text-white hover:bg-green-700"
                        : "h-9 min-w-9 border border-zinc-300 bg-white px-3 text-zinc-700 hover:bg-zinc-50"
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                className="h-9 border-zinc-300 bg-white px-3"
              >
                Sau
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className="h-9 border-zinc-300 bg-white px-3">
                <Link href={buildPageHref(filters, page + 1)}>Sau</Link>
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
