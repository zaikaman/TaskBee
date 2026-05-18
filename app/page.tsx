"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Code2,
  FileText,
  Megaphone,
  MonitorSmartphone,
  MousePointerClick,
  PenLine,
  Search,
  ShieldCheck,
  Smartphone,
  Star,
  WalletCards,
} from "lucide-react";
import posthog from "posthog-js";
import { SiteFooter } from "@/components/layout/site-footer";

const categories = [
  {
    title: "Tiếp thị số",
    count: "Nhiệm vụ quảng bá, chia sẻ nội dung",
    icon: Megaphone,
  },
  {
    title: "Khảo sát nhanh",
    count: "Thu thập ý kiến và phản hồi thật",
    icon: FileText,
  },
  {
    title: "Kiểm thử ứng dụng",
    count: "Trải nghiệm app, báo lỗi, góp ý",
    icon: Smartphone,
  },
  {
    title: "Tương tác mạng xã hội",
    count: "Theo dõi, bình luận, lưu bài viết",
    icon: MousePointerClick,
  },
  {
    title: "Nhập liệu ngắn",
    count: "Xử lý dữ liệu nhỏ, dễ kiểm tra",
    icon: PenLine,
  },
  {
    title: "Kiểm tra website",
    count: "Rà soát giao diện và luồng thao tác",
    icon: MonitorSmartphone,
  },
  {
    title: "Lập trình nhỏ",
    count: "Việc kỹ thuật gọn, có tiêu chí rõ",
    icon: Code2,
  },
  {
    title: "Tất cả nhiệm vụ nhỏ",
    count: "Xem toàn bộ danh mục đang mở",
    icon: ArrowRight,
    featured: true,
  },
];

const faqs = [
  {
    question: "Người đăng việc có bị tính phí cho mọi lượt làm không?",
    answer:
      "Không. TaskBee chỉ nên thanh toán cho phần việc đạt yêu cầu theo mô tả đã đăng. Người đăng việc cần mô tả tiêu chí nghiệm thu rõ ràng để cộng tác viên biết chính xác cần nộp gì.",
  },
  {
    question: "Nhiệm vụ nào không phù hợp trên TaskBee?",
    answer:
      "Không đăng nhiệm vụ yêu cầu spam, gây hại website, tạo đánh giá giả, cung cấp thông tin nhạy cảm, thao túng nền tảng bên thứ ba hoặc thực hiện hành vi trái pháp luật.",
  },
  {
    question: "Bao lâu thì nhiệm vụ được duyệt?",
    answer:
      "Các nhiệm vụ có mô tả rõ, ngân sách hợp lệ và bằng chứng nghiệm thu cụ thể sẽ được xử lý nhanh hơn. Hệ thống ưu tiên những việc nhỏ có thể kiểm tra minh bạch.",
  },
  {
    question: "TaskBee phù hợp với loại công việc nào?",
    answer:
      "TaskBee phù hợp với những nhiệm vụ nhỏ, lặp lại, có hướng dẫn rõ và có thể xác minh kết quả: khảo sát, kiểm thử, thu thập dữ liệu, quảng bá nội dung hoặc thao tác đơn giản trên nền tảng số.",
  },
];

function TaskBeeLogo() {
  return (
    <span className="flex items-center gap-3 text-[#22ab59]">
      <svg className="size-10" viewBox="0 0 48 48" role="img" aria-label="TaskBee">
        <path
          d="M12 31c3 5 11 8 18 4 6-4 10-12 7-20-7-2-15 0-20 6-3 4-4 8-3 12"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        <path
          d="M10 34c7-1 12-5 15-12"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="3"
        />
      </svg>
      <span className="text-xl font-black">TaskBee</span>
    </span>
  );
}

function CurvedArrow({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 360 130"
      aria-hidden="true"
      fill="none"
      preserveAspectRatio="none"
    >
      <path
        d="M6 44c56-18 82 10 122 36 38 25 76 5 63-37-8-26-38-21-44 0-7 24 26 48 92 52 46 3 84-2 112-20"
        stroke="#18c46b"
        strokeLinecap="round"
        strokeWidth="7"
      />
      <path d="M326 42l28 32-36 22" stroke="#18c46b" strokeLinecap="round" strokeWidth="7" />
    </svg>
  );
}

function DashboardMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[445px] rounded-[7px] bg-[#eadfff] pt-9 shadow-sm sm:pt-12">
      <div className="mx-auto min-h-[330px] w-[89%] overflow-hidden bg-white shadow-[0_22px_70px_rgba(32,50,89,0.12)]">
        <div className="flex h-12 items-center justify-between border-b border-[#f0f2f5] px-5 text-[11px]">
          <TaskBeeLogo />
          <span className="font-bold text-[#203259]">Việc của tôi</span>
          <span className="text-[#686d77]">Ví tiền</span>
        </div>
        <div className="bg-[#fff3cf] px-8 py-3 text-xs font-medium text-[#9a6a00]">
          API | Mời cộng tác viên | Báo cáo
        </div>
        <div className="space-y-5 p-6">
          <div className="flex items-center gap-4">
            <div className="grid size-14 place-items-center rounded-full bg-[#d7f3e3] text-2xl font-black text-[#22ab59]">
              B
            </div>
            <div>
              <p className="font-bold text-[#203259]">Bích Hạnh</p>
              <div className="mt-1 flex items-center gap-1 text-[#18c46b]">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} className="size-3 fill-current" />
                ))}
                <span className="ml-1 text-xs text-[#686d77]">98 đánh giá</span>
              </div>
            </div>
          </div>
          <div>
            <div className="mb-3 flex gap-2">
              <span className="rounded bg-[#f2f4f7] px-2 py-1 text-[10px] font-bold text-[#686d77]">
                KHẢO SÁT
              </span>
              <span className="rounded bg-[#f2f4f7] px-2 py-1 text-[10px] font-bold text-[#686d77]">
                ỨNG DỤNG
              </span>
            </div>
            <p className="font-bold leading-snug text-[#30394d]">
              Kiểm thử luồng đăng ký và gửi bằng chứng màn hình
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="h-16 rounded border border-[#d3dae6] bg-[#e7faef]" />
            <div className="h-16 rounded border border-[#d3dae6] bg-[#f2f4f7]" />
            <div className="h-16 rounded border border-[#d3dae6] bg-[#fff3cf]" />
          </div>
          <div className="border-t border-[#f0f2f5] pt-5">
            <div className="h-2 w-full rounded bg-[#f2f4f7]" />
            <div className="mt-2 h-2 w-2/3 rounded bg-[#f2f4f7]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskListMockup() {
  const rows = [
    ["KHẢO SÁT", "Đánh giá trải nghiệm mở tài khoản thử", "Đang nhận", "8.000đ"],
    ["KIỂM THỬ", "Chụp lỗi giao diện trên điện thoại Android", "Chờ duyệt", "12.000đ"],
    ["NHẬP LIỆU", "Chuẩn hóa 20 dòng dữ liệu sản phẩm", "Hoàn tất", "18.000đ"],
  ];

  return (
    <div className="rounded-[7px] bg-[#dff3f8] p-6 sm:p-14">
      <div className="rounded-[7px] bg-white p-6 shadow-[0_18px_55px_rgba(32,50,89,0.08)] sm:p-10">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-2xl font-bold text-[#30394d]">Nhiệm vụ nhỏ</h3>
            <div className="mt-7 flex h-10 w-full max-w-[260px] items-center gap-3 bg-[#f5f7fa] px-4 text-[#a8b0bf]">
              <span className="text-sm">Tìm kiếm</span>
              <Search className="ml-auto size-4" />
            </div>
          </div>
          <button className="h-10 border border-[#d3dae6] px-5 text-sm font-black uppercase text-[#22ab59]">
            + Đăng việc
          </button>
        </div>
        <div className="mt-6 space-y-3">
          {rows.map(([tag, title, status, price], index) => (
            <div
              key={title}
              className="grid gap-3 border border-[#f0f2f5] border-l-2 border-l-[#22ab59] p-4 text-sm text-[#30394d] sm:grid-cols-[1fr_150px_90px]"
            >
              <div>
                <span className="whitespace-nowrap rounded bg-[#f2f4f7] px-2 py-1 text-[10px] font-bold text-[#686d77]">
                  {tag}
                </span>
                <p className="mt-2 break-normal font-medium">{title}</p>
              </div>
              <span className="self-center whitespace-nowrap font-bold text-[#22ab59]">{status}</span>
              <span className="self-center justify-self-start whitespace-nowrap font-black sm:justify-self-end">
                {price}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="home min-h-screen bg-white text-[#1b1b1b]">
      <section className="bg-[#e7faef]">
        <header className="mx-auto flex min-h-20 max-w-[1090px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="shrink-0" aria-label="TaskBee">
            <TaskBeeLogo />
          </Link>

          <nav className="hidden items-center gap-12 text-sm font-bold text-[#203259] md:flex">
            <Link href="/viec-lam" className="hover:text-[#22ab59]">
              Khám phá nhiệm vụ
            </Link>
            <Link href="/dashboard/employer/tasks/create" className="hover:text-[#22ab59]">
              Đăng việc nhỏ
            </Link>
          </nav>

          <div className="flex shrink-0 items-center gap-3 text-sm font-medium sm:gap-7">
            <Link
              href="/login"
              className="hidden text-[#22ab59] hover:text-[#005924] sm:inline"
              onClick={() => posthog.capture("landing_login_clicked", { location: "header" })}
            >
              Đăng nhập
            </Link>
            <Link
              href="/register"
              className="rounded-[3px] bg-[#22ab59] px-4 py-3 font-bold text-white shadow-sm hover:bg-[#005924] sm:px-6"
              onClick={() => posthog.capture("landing_register_clicked", { location: "header" })}
            >
              Đăng ký
            </Link>
          </div>
        </header>

        <div className="mx-auto grid max-w-[1090px] gap-10 px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-16 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:items-center">
          <div>
            <h1 className="max-w-[440px] text-4xl font-black uppercase leading-[1.18] tracking-normal text-[#30394d] sm:text-5xl lg:text-[56px]">
              Thuê người thật cho mọi nhiệm vụ nhỏ
            </h1>
            <p className="mt-6 max-w-[420px] text-base leading-[1.55] text-black sm:text-xl">
              TaskBee kết nối doanh nghiệp với cộng tác viên Việt Nam để hoàn thành
              các việc nhỏ dễ giao, dễ kiểm tra và tối ưu chi phí vận hành.
            </p>

            <div className="mt-8 flex w-full max-w-[320px] flex-col items-stretch gap-4 sm:items-center sm:gap-6">
              <Link
                href="/dashboard/employer/tasks/create"
                className="flex h-16 w-full items-center justify-center rounded-[7px] bg-[#22ab59] px-8 text-base font-black uppercase text-white hover:bg-[#005924]"
                onClick={() =>
                  posthog.capture("landing_create_task_clicked", { location: "hero_cta" })
                }
              >
                Đăng nhiệm vụ nhỏ
              </Link>
              <Link
                href="/viec-lam"
                className="text-xl text-[#22ab59] hover:text-[#005924]"
                onClick={() =>
                  posthog.capture("landing_browse_tasks_clicked", { location: "hero_cta" })
                }
              >
                hoặc xem nhiệm vụ đang mở
              </Link>
            </div>
          </div>

          <div className="relative min-h-[430px]">
            <CurvedArrow className="absolute left-0 top-2 hidden h-28 w-80 lg:block" />
            <DashboardMockup />

            <div className="absolute right-[-70px] top-[105px] hidden rounded-[7px] bg-white px-5 py-4 shadow-[0_18px_45px_rgba(32,50,89,0.14)] xl:block">
              <p className="text-base text-[#30394d]">Bạn có 2 lượt nộp mới</p>
              <Link href="/dashboard/employer/tasks" className="mt-2 inline-block text-[#22ab59] underline">
                Xem nhiệm vụ
              </Link>
            </div>

            <div className="absolute bottom-12 left-0 hidden rounded-[7px] bg-white px-5 py-4 shadow-[0_18px_45px_rgba(32,50,89,0.14)] lg:block">
              <p className="text-sm text-[#30394d]">Bằng chứng đã sẵn sàng duyệt</p>
              <Link href="/dashboard/employer/tasks" className="mt-2 inline-block text-sm text-[#22ab59] underline">
                Mở bảng việc
              </Link>
            </div>
          </div>

          <p className="flex max-w-[540px] items-start gap-3 text-base italic leading-snug text-black sm:gap-4 sm:text-xl lg:col-start-2">
            <CheckCircle2 className="mt-1 size-6 shrink-0 text-[#22ab59]" aria-hidden="true" />
            Tiếp cận cộng tác viên thật, giao nhiệm vụ rõ ràng, nhận bằng chứng và
            quản lý thanh toán trong cùng một nơi.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1090px] px-4 py-20 sm:px-6 sm:py-28">
        <h2 className="text-3xl font-black leading-tight text-[#30394d] sm:text-[44px]">
          Danh mục nhiệm vụ nhỏ phổ biến
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Link
                href="/viec-lam"
                key={category.title}
                className={`flex min-h-28 items-center gap-5 rounded-[7px] p-7 transition hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(32,50,89,0.08)] ${
                  category.featured ? "bg-[#fff3cf]" : "bg-[#f5f7fa]"
                }`}
                onClick={() =>
                  posthog.capture("landing_category_clicked", { category: category.title })
                }
              >
                <Icon className="size-10 shrink-0 text-[#00c76f]" strokeWidth={1.6} />
                <span>
                  <span className="block text-xl font-bold text-[#203259]">{category.title}</span>
                  <span className="mt-1 block text-sm text-[#7f7e7e]">{category.count}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[1090px] px-4 py-6 sm:px-6">
        <h2 className="max-w-[900px] text-4xl font-black uppercase leading-[1.18] text-[#203259] sm:text-5xl">
          Một nền tảng, nhiều cách hoàn thành việc nhỏ
        </h2>

        <div className="mt-16 grid gap-14 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div className="relative">
            <div className="absolute -right-5 -top-10 hidden h-72 w-72 rounded-[7px] bg-[#fce3e5] lg:block" />
            <div className="relative rounded-[7px] border border-[#f0f2f5] bg-white p-8 shadow-[0_16px_50px_rgba(32,50,89,0.08)]">
              <h3 className="text-xl font-bold text-[#30394d]">Đăng nhiệm vụ</h3>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                {["Toàn quốc", "Theo tỉnh thành", "Theo thiết bị", "Theo kỹ năng"].map((item, index) => (
                  <div
                    key={item}
                    className={`border px-4 py-3 text-center ${
                      index === 0
                        ? "border-[#e7faef] bg-[#e7faef] text-[#22ab59]"
                        : "border-[#d3dae6] text-[#30394d]"
                    }`}
                  >
                    {item}
                  </div>
                ))}
              </div>
              <p className="mt-7 text-sm text-[#30394d]">
                Chọn nhóm người làm, ngân sách, số lượng kết quả và bằng chứng cần nộp.
              </p>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {["Ảnh", "Mã đơn", "Liên kết", "Ghi chú"].map((item) => (
                  <span key={item} className="bg-[#f5f7fa] px-3 py-2 text-center text-xs text-[#686d77]">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-7 inline-flex size-13 items-center justify-center rounded-[4px] bg-[#fff3cf] text-xl font-black text-[#ffb800]">
              1
            </div>
            <p className="text-sm font-black text-[#00a149]">Dành cho người đăng việc</p>
            <h3 className="mt-4 text-3xl font-black leading-tight text-[#203259]">
              Chia nhỏ công việc và nhận nhiều kết quả thật
            </h3>
            <p className="mt-6 text-xl leading-relaxed text-black">
              Nhiệm vụ nhỏ phù hợp cho các việc cần nhiều người thực hiện trong thời
              gian ngắn: kiểm thử, khảo sát, thu thập dữ liệu, quảng bá nội dung hoặc
              thao tác số có hướng dẫn cụ thể.
            </p>
          </div>
        </div>

        <div className="mt-24 grid gap-12 lg:grid-cols-2 lg:items-start">
          <div>
            <div className="mb-7 inline-flex size-13 items-center justify-center rounded-[4px] bg-[#fff3cf] text-xl font-black text-[#ffb800]">
              2
            </div>
            <h3 className="text-3xl font-black leading-tight text-[#203259]">
              Kiểm soát chất lượng bằng tiêu chí nghiệm thu
            </h3>
            <p className="mt-6 max-w-[500px] text-xl leading-relaxed text-black">
              Mỗi nhiệm vụ nên có mô tả rõ, thời hạn, mẫu bằng chứng và điều kiện
              duyệt. Điều này giúp cộng tác viên làm đúng ngay từ đầu và giảm thời
              gian kiểm tra lại.
            </p>
          </div>
          <div className="rounded-[7px] bg-[#f5f7fa] p-8 sm:p-12">
            <h4 className="text-2xl font-bold text-[#203259]">Tổng quan</h4>
            <p className="mt-6 max-w-[430px] text-lg leading-relaxed">
              TaskBee hiển thị tiến độ, bằng chứng, trạng thái duyệt và lịch sử thanh
              toán để đội vận hành theo dõi từng nhiệm vụ nhỏ một cách minh bạch.
            </p>
            <div className="mt-8 space-y-4">
              {["Cộng tác viên đã xác minh", "Bằng chứng theo mẫu", "Thanh toán qua ví"].map((item) => (
                <div key={item} className="flex items-center gap-4 rounded-[7px] bg-white p-4 shadow-sm">
                  <ShieldCheck className="size-8 text-[#22ab59]" />
                  <span className="font-bold text-[#30394d]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-24">
          <div className="max-w-[620px]">
            <div className="mb-7 inline-flex size-13 items-center justify-center rounded-[4px] bg-[#fff3cf] text-xl font-black text-[#ffb800]">
              3
            </div>
            <h3 className="text-3xl font-black leading-tight text-[#203259]">
              Quản lý nhiệm vụ bằng bảng việc rõ ràng
            </h3>
            <p className="mt-6 text-xl leading-relaxed text-black">
              Theo dõi nhiệm vụ đang nhận lượt làm, nhiệm vụ chờ duyệt và nhiệm vụ đã
              hoàn tất trong một giao diện thống nhất.
            </p>
          </div>
          <div className="mt-10">
            <TaskListMockup />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1090px] px-4 py-20 sm:px-6 sm:py-28">
        <div className="rounded-[7px] bg-[#dff3f8] px-6 py-16 text-center sm:px-12">
          <h2 className="mx-auto max-w-[720px] text-4xl font-black leading-tight text-[#203259] sm:text-5xl">
            Hoàn thành nhiều nhiệm vụ nhỏ với chi phí dễ kiểm soát
          </h2>
          <p className="mx-auto mt-6 max-w-[460px] text-xl leading-relaxed">
            Đăng việc, nhận lượt nộp, duyệt bằng chứng và thanh toán cho kết quả đạt yêu cầu.
          </p>
          <div className="relative mx-auto mt-12 max-w-[620px]">
            <CurvedArrow className="absolute -left-24 -top-20 hidden h-28 w-56 rotate-12 lg:block" />
            <div className="-rotate-2 rounded-[7px] bg-white p-5 shadow-[0_20px_55px_rgba(32,50,89,0.12)]">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-bold text-[#30394d]">Hoàn thành khảo sát sản phẩm</span>
                <span className="font-black text-[#22ab59]">10.000đ</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-[#f2f4f7]">
                <div className="h-2 w-2/3 rounded-full bg-[#22ab59]" />
              </div>
            </div>
            <div className="relative mx-auto -mt-4 max-w-[560px] rounded-[7px] border-l-4 border-[#22ab59] bg-white p-5 text-left shadow-[0_20px_55px_rgba(32,50,89,0.12)]">
              <span className="rounded bg-[#f2f4f7] px-2 py-1 text-[10px] font-bold text-[#686d77]">
                KIỂM THỬ
              </span>
              <p className="mt-2 font-bold text-[#30394d]">
                Gửi ảnh màn hình sau khi hoàn thành luồng đăng ký
              </p>
            </div>
          </div>
          <Link
            href="/register"
            className="mt-12 inline-flex h-16 min-w-[220px] items-center justify-center rounded-[7px] bg-[#22ab59] px-8 font-black uppercase text-white hover:bg-[#005924]"
            onClick={() => posthog.capture("landing_register_clicked", { location: "bottom_cta" })}
          >
            Bắt đầu ngay
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1090px] gap-12 px-4 pb-24 sm:px-6 lg:grid-cols-[0.75fr_1fr]">
        <h2 className="text-4xl font-black leading-tight text-[#203259] sm:text-5xl">
          Câu hỏi thường gặp
        </h2>
        <div className="space-y-6">
          {faqs.map((faq, index) => (
            <details key={faq.question} className="group border-b border-[#f0f2f5] pb-5" open={index === 0}>
              <summary className="flex cursor-pointer list-none items-center gap-4 text-lg font-black text-[#203259] marker:hidden">
                <span className="text-2xl font-normal text-[#00a149] group-open:hidden">+</span>
                <span className="hidden text-2xl font-normal text-[#00a149] group-open:inline">-</span>
                <span className="underline-offset-4 group-open:text-[#00a149] group-open:underline">
                  {faq.question}
                </span>
                <ChevronDown className="ml-auto size-4 text-[#a8b0bf] group-open:rotate-180" />
              </summary>
              <p className="ml-10 mt-5 max-w-[560px] text-lg leading-relaxed text-black">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="border-y border-[#f0f2f5] bg-[#f5f7fa]">
        <div className="mx-auto grid max-w-[1090px] gap-6 px-4 py-14 sm:px-6 sm:py-16 md:grid-cols-3">
          {[
            ["Đăng việc rõ ràng", "Mô tả, ngân sách và bằng chứng nằm trong một luồng."],
            ["Duyệt kết quả minh bạch", "Theo dõi từng lượt nộp và trạng thái nghiệm thu."],
            ["Ví thanh toán tập trung", "Quản lý số dư, chi phí và lịch sử giao dịch."],
          ].map(([title, body]) => (
            <div key={title} className="flex gap-4">
              <WalletCards className="size-8 shrink-0 text-[#22ab59]" />
              <div>
                <h3 className="font-black text-[#203259]">{title}</h3>
                <p className="mt-2 leading-relaxed text-[#686d77]">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
