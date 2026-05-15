"use client";

import { useEffect } from "react";
import Link from "next/link";
import posthog from "posthog-js";
import { ExternalLink, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { formatVnd } from "@/lib/utils/money";
import { TaskStatus, TaskType } from "@/lib/generated/prisma/enums";
import type { MarketplaceTaskListItem } from "@/lib/services/marketplace";
import type { TaskFilterInput } from "@/lib/validators/task";

type MarketplacePageClientProps = {
  tasks: MarketplaceTaskListItem[];
  categories: string[];
  filters: TaskFilterInput;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

const taskTypeLabels: Record<TaskType, string> = {
  EXPRESS: "Việc nhanh",
  CLASSIC: "Việc tiêu chuẩn",
  LIST: "Danh sách việc",
};

function firstPageHref() {
  return "/viec-lam";
}

function formatRelativeTime(date: Date) {
  const diffInMs = Date.now() - date.getTime();
  const diffInDays = Math.max(0, Math.floor(diffInMs / (24 * 60 * 60 * 1000)));

  if (diffInDays <= 0) {
    return "Hôm nay";
  }

  if (diffInDays === 1) {
    return "1 ngày trước";
  }

  if (diffInDays < 7) {
    return `${diffInDays} ngày trước`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);

  if (diffInWeeks < 5) {
    return `${diffInWeeks} tuần trước`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);

  if (diffInMonths < 12) {
    return `${diffInMonths} tháng trước`;
  }

  const diffInYears = Math.floor(diffInDays / 365);

  return `${diffInYears} năm trước`;
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
  categories,
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

  const startIndex = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);
  const hasFiltersApplied =
    Boolean(filters.search?.trim()) ||
    Boolean(filters.category) ||
    filters.status !== TaskStatus.ACTIVE ||
    filters.minReward !== undefined ||
    filters.maxReward !== undefined;
  const visiblePages = totalPages > 1 ? buildVisiblePages(page, totalPages) : [];

  return (
    <div className="space-y-6 bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm text-slate-500">
              Hiển thị {startIndex}-{endIndex} trên {totalCount.toLocaleString("vi-VN")} việc
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
              Tìm việc làm thật, đã được đồng bộ từ cơ sở dữ liệu
            </h1>
          </div>

          <div className="text-sm leading-6 text-slate-500">
            Lọc theo từ khóa, danh mục, trạng thái và khoảng thưởng để tìm việc phù hợp nhất.
          </div>
        </div>

        <form
          action="/viec-lam"
          method="get"
          onSubmit={(event) => {
            const formData = new FormData(event.currentTarget);

            posthog.capture("marketplace_filters_applied", {
              search: String(formData.get("search") ?? ""),
              category: String(formData.get("category") ?? ""),
              status: String(formData.get("status") ?? ""),
              min_reward: String(formData.get("minReward") ?? ""),
              max_reward: String(formData.get("maxReward") ?? ""),
            });
          }}
          className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 xl:grid-cols-12"
        >
          <input type="hidden" name="page" value="1" />
          <input type="hidden" name="pageSize" value={String(pageSize)} />

          <label className="relative xl:col-span-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              defaultValue={filters.search ?? ""}
              name="search"
              placeholder="Tìm kiếm tiêu đề, mô tả hoặc hướng dẫn"
              className="h-11 bg-white pl-9"
            />
          </label>

          <label className="xl:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Trạng thái
            </span>
            <select
              defaultValue={filters.status ?? TaskStatus.ACTIVE}
              name="status"
              className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none ring-0 transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            >
              <option value={TaskStatus.ACTIVE}>Đang hoạt động</option>
              <option value={TaskStatus.PAUSED}>Tạm dừng</option>
              <option value={TaskStatus.COMPLETED}>Hoàn thành</option>
              <option value={TaskStatus.CANCELLED}>Đã huỷ</option>
            </select>
          </label>

          <label className="xl:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Danh mục
            </span>
            <select
              defaultValue={filters.category ?? ""}
              name="category"
              className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none ring-0 transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="xl:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Thưởng tối thiểu
            </span>
            <Input
              defaultValue={filters.minReward !== undefined ? String(filters.minReward) : ""}
              name="minReward"
              placeholder="0"
              type="number"
              min="0"
              step="1000"
              className="h-11 bg-white"
            />
          </label>

          <label className="xl:col-span-2">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Thưởng tối đa
            </span>
            <Input
              defaultValue={filters.maxReward !== undefined ? String(filters.maxReward) : ""}
              name="maxReward"
              placeholder="100000"
              type="number"
              min="0"
              step="1000"
              className="h-11 bg-white"
            />
          </label>

          <div className="flex flex-wrap items-end justify-between gap-2 xl:col-span-12">
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-white px-3 py-1.5">
                {filters.status === TaskStatus.ACTIVE ? "Chỉ việc còn mở slot" : "Xem theo trạng thái đã chọn"}
              </span>
              {hasFiltersApplied ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
                  Bộ lọc đang được áp dụng
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              {hasFiltersApplied ? (
                <Button variant="outline" asChild className="h-11 border-slate-300 bg-white">
                  <Link href={firstPageHref()}>Xoá bộ lọc</Link>
                </Button>
              ) : null}
              <Button type="submit" className="h-11 bg-emerald-600 px-6 text-white hover:bg-emerald-700">
                Lọc kết quả
              </Button>
            </div>
          </div>
        </form>
      </div>

      <div className="space-y-3 px-4">
        {tasks.length > 0 ? (
          tasks.map((task) => {
            const progress = task.totalSlots > 0 ? Math.round((task.claimedSlots / task.totalSlots) * 100) : 0;
            const accentClass =
              progress >= 80
                ? "border-l-rose-500"
                : progress >= 50
                  ? "border-l-amber-500"
                  : "border-l-emerald-500";
            const excerpt =
              task.description.length > 180
                ? `${task.description.slice(0, 180).trimEnd()}…`
                : task.description;

            return (
              <article
                key={task.id}
                className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md border-l-4 ${accentClass}`}
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                        {taskTypeLabels[task.taskType]}
                      </Badge>
                      {task.category ? (
                        <Badge variant="outline" className="border-slate-200 text-slate-600">
                          {task.category}
                        </Badge>
                      ) : null}
                      <TaskStatusBadge status={task.status} showIcon={false} />
                    </div>

                    <div>
                      <Link
                        href={`/viec-lam/${task.id}`}
                        className="text-lg font-semibold leading-snug text-slate-900 transition-colors hover:text-emerald-700"
                      >
                        {task.title}
                      </Link>

                      <p className="mt-2 text-sm leading-6 text-slate-600">{excerpt}</p>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
                      <span>{formatRelativeTime(task.publishedAt ?? task.createdAt)}</span>
                      <span>{task.autoApproveDays} ngày xét duyệt</span>
                      <span>Nhà tuyển việc: {task.employer.username ?? "đã ẩn danh"}</span>
                    </div>
                  </div>

                  <div className="w-full lg:w-[320px]">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Phần thưởng / suất
                          </p>
                          <p className="mt-1 text-2xl font-black text-emerald-600">{formatVnd(task.rewardAmount)}</p>
                        </div>

                        <Button asChild variant="ghost" size="icon" className="size-9">
                          <Link href={`/viec-lam/${task.id}`} aria-label="Xem chi tiết công việc">
                            <ExternalLink className="size-4" />
                          </Link>
                        </Button>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Đã giữ chỗ</span>
                          <span>
                            {task.claimedSlots.toLocaleString("vi-VN")}/{task.totalSlots.toLocaleString("vi-VN")}
                          </span>
                        </div>

                        <div className="h-2 rounded-full bg-slate-200">
                          <div
                            className={`h-2 rounded-full ${
                              progress >= 80
                                ? "bg-rose-500"
                                : progress >= 50
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>Còn lại</span>
                          <span>{task.availableSlots.toLocaleString("vi-VN")}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <h2 className="text-lg font-semibold text-slate-900">Không tìm thấy công việc phù hợp</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Hãy thử đổi từ khóa, danh mục, trạng thái hoặc khoảng thưởng để mở rộng kết quả hiển thị.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
                <Link href={firstPageHref()}>Quay lại danh sách gốc</Link>
              </Button>
            </div>
          </div>
        )}
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-col gap-4 px-4 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Trang {page.toLocaleString("vi-VN")} / {totalPages.toLocaleString("vi-VN")}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {page <= 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                className="h-9 border-slate-300 bg-white px-3"
              >
                Trước
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className="h-9 border-slate-300 bg-white px-3">
                <Link href={buildPageHref(filters, page - 1)}>Trước</Link>
              </Button>
            )}

            {visiblePages.map((visiblePage, index) => {
              const previousPage = visiblePages[index - 1];
              const shouldShowGap = previousPage !== undefined && visiblePage - previousPage > 1;

              return (
                <div key={visiblePage} className="flex items-center gap-2">
                  {shouldShowGap ? <span className="px-1 text-slate-400">…</span> : null}
                  <Button
                    type="button"
                    size="sm"
                    className={
                      visiblePage === page
                        ? "h-9 min-w-9 bg-emerald-600 px-3 text-white hover:bg-emerald-700"
                        : "h-9 min-w-9 border border-slate-300 bg-white px-3 text-slate-700 hover:bg-slate-50"
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
                className="h-9 border-slate-300 bg-white px-3"
              >
                Sau
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className="h-9 border-slate-300 bg-white px-3">
                <Link href={buildPageHref(filters, page + 1)}>Sau</Link>
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
