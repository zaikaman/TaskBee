import Link from "next/link";

type AdminPaginationProps = {
  basePath: string;
  page: number;
  pageSize: number;
  totalCount: number;
  params?: Record<string, string | undefined>;
};

function buildHref(basePath: string, params: Record<string, string | undefined>, page: number) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  searchParams.set("page", String(page));

  return `${basePath}?${searchParams.toString()}`;
}

export function normalizeAdminPage(page?: string) {
  const parsedPage = Number(page);

  if (!Number.isFinite(parsedPage)) {
    return 1;
  }

  return Math.max(1, Math.floor(parsedPage));
}

export function AdminPagination({
  basePath,
  page,
  pageSize,
  totalCount,
  params = {},
}: AdminPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const startItem = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(totalCount, safePage * pageSize);
  const previousPage = Math.max(1, safePage - 1);
  const nextPage = Math.min(totalPages, safePage + 1);

  return (
    <div className="flex flex-col gap-3 border-t border-[#f0f2f5] px-5 py-4 text-sm text-[#4a5568] sm:flex-row sm:items-center sm:justify-between">
      <p>
        Hiển thị <span className="font-bold text-[#001b49]">{startItem}</span>-
        <span className="font-bold text-[#001b49]">{endItem}</span> trong{" "}
        <span className="font-bold text-[#001b49]">{totalCount}</span> mục
      </p>
      <nav className="flex flex-wrap items-center gap-2" aria-label="Phân trang">
        <Link
          aria-disabled={safePage === 1}
          className={
            safePage === 1
              ? "pointer-events-none rounded bg-[#f5f7fa] px-3 py-2 font-bold text-[#a8b0bf]"
              : "rounded bg-white px-3 py-2 font-bold text-[#203259] ring-1 ring-[#d3dae6] hover:bg-[#e7faef] hover:text-[#005924]"
          }
          href={buildHref(basePath, params, previousPage)}
        >
          Trước
        </Link>
        <span className="rounded bg-[#001b49] px-3 py-2 font-bold text-white">
          {safePage}/{totalPages}
        </span>
        <Link
          aria-disabled={safePage === totalPages}
          className={
            safePage === totalPages
              ? "pointer-events-none rounded bg-[#f5f7fa] px-3 py-2 font-bold text-[#a8b0bf]"
              : "rounded bg-white px-3 py-2 font-bold text-[#203259] ring-1 ring-[#d3dae6] hover:bg-[#e7faef] hover:text-[#005924]"
          }
          href={buildHref(basePath, params, nextPage)}
        >
          Sau
        </Link>
      </nav>
    </div>
  );
}
