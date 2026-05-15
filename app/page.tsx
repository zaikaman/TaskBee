"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Leaf } from "lucide-react";
import posthog from "posthog-js";
import { SiteFooter } from "@/components/layout/site-footer";

const categories = [
  "Đăng ký tài khoản",
  "Khảo sát nhanh",
  "Tải ứng dụng",
  "Tương tác mạng xã hội",
];

const stats = [
  { label: "nhiệm vụ đang mở", value: "629+" },
  { label: "phí nền tảng rõ ràng", value: "10%" },
  { label: "duyệt tự động tối đa", value: "7 ngày" },
];

export default function LandingPage() {
  return (
    <main className="home min-h-screen bg-white text-[#1b1b1b]">
      <section className="bg-[#e7faef]">
        <header className="mx-auto flex h-24 max-w-[1090px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 text-[#22ab59]">
            <span className="flex size-9 items-center justify-center rounded-full border-2 border-[#22ab59]">
              <Leaf className="size-5" aria-hidden="true" />
            </span>
            <span className="text-xl font-bold">TaskBee</span>
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
            <Link
              href="/login"
              className="hidden text-[#22ab59] hover:text-[#005924] sm:inline"
              onClick={() => posthog.capture("landing_login_clicked", { location: "header" })}
            >
              Đăng nhập
            </Link>
            <Link
              href="/register"
              className="rounded-[3px] bg-[#22ab59] px-6 py-3 font-bold text-white shadow-sm hover:bg-[#005924]"
              onClick={() => posthog.capture("landing_register_clicked", { location: "header" })}
            >
              Đăng ký
            </Link>
          </div>
        </header>

        <div className="mx-auto grid max-w-[1090px] gap-12 px-6 pb-28 pt-20 lg:grid-cols-[460px_1fr] lg:items-center">
          <div>
            <h1 className="max-w-[440px] text-5xl font-black uppercase leading-[1.18] tracking-[0.01em] text-[#30394d] sm:text-[56px]">
              Thuê người thật cho mọi nhiệm vụ
            </h1>
            <p className="mt-7 max-w-[360px] text-xl leading-[1.45] text-black">
              TaskBee kết nối doanh nghiệp với cộng tác viên Việt Nam để hoàn thành các nhiệm vụ
              số nhỏ, dễ kiểm chứng và chi phí hợp lý.
            </p>

            <div className="mt-10 flex max-w-[320px] flex-col items-center gap-6">
              <Link
                href="/register"
                className="flex h-16 w-full items-center justify-center rounded-[7px] bg-[#22ab59] px-8 text-base font-black uppercase text-white hover:bg-[#005924]"
                onClick={() =>
                  posthog.capture("landing_register_clicked", { location: "hero_cta" })
                }
              >
                Đăng việc nhỏ
              </Link>
              <Link
                href="/marketplace"
                className="text-xl text-[#22ab59] hover:text-[#005924]"
                onClick={() =>
                  posthog.capture("landing_browse_tasks_clicked", { location: "hero_cta" })
                }
              >
                hoặc duyệt việc
              </Link>
            </div>
          </div>

          <div className="relative min-h-[420px]">
            <div className="absolute left-0 top-8 hidden h-32 w-80 rounded-[50%] border-t-[6px] border-[#18c46b] lg:block" />
            <ArrowRight className="absolute left-[275px] top-[88px] hidden size-16 text-[#18c46b] lg:block" />

            <div className="absolute right-0 top-6 w-full max-w-[445px] rounded-[7px] bg-[#eadfff] pt-12 shadow-sm">
              <div className="mx-auto min-h-[345px] w-[88%] bg-white shadow-[0_20px_60px_rgba(32,50,89,0.10)]">
                <div className="flex h-12 items-center justify-between border-b border-[#f0f2f5] px-8 text-xs">
                  <span className="flex items-center gap-2 font-bold text-[#22ab59]">
                    <Leaf className="size-4" /> TaskBee
                  </span>
                  <span className="text-[#686d77]">Việc của tôi</span>
                  <span className="text-[#686d77]">Ví tiền</span>
                </div>
                <div className="space-y-5 p-8">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded-full bg-[#d7f3e3]" />
                    <div>
                      <div className="h-3 w-24 rounded bg-[#203259]" />
                      <div className="mt-2 h-2 w-36 rounded bg-[#d3dae6]" />
                    </div>
                  </div>
                  <div>
                    <div className="mb-4 flex gap-2">
                      <span className="rounded bg-[#f2f4f7] px-2 py-1 text-[10px] font-bold text-[#686d77]">
                        TIẾP THỊ SỐ
                      </span>
                      <span className="rounded bg-[#f2f4f7] px-2 py-1 text-[10px] font-bold text-[#686d77]">
                        ỨNG DỤNG
                      </span>
                    </div>
                    <div className="h-4 w-72 rounded bg-[#30394d]" />
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <div className="h-12 rounded bg-[#e7faef]" />
                      <div className="h-12 rounded bg-[#f2f4f7]" />
                      <div className="h-12 rounded bg-[#fff3cf]" />
                    </div>
                  </div>
                  <div className="border-t border-[#f0f2f5] pt-4">
                    <div className="h-2 w-full rounded bg-[#f2f4f7]" />
                    <div className="mt-2 h-2 w-2/3 rounded bg-[#f2f4f7]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute right-[-70px] top-[102px] hidden rounded-[7px] bg-white px-5 py-4 shadow-[0_18px_45px_rgba(32,50,89,0.14)] xl:block">
              <p className="text-base text-[#30394d]">Bạn có 2 lời mời việc mới</p>
              <Link href="/marketplace" className="mt-2 inline-block text-[#22ab59] underline">
                Đi tới việc của tôi
              </Link>
            </div>

            <div className="absolute bottom-12 left-8 hidden rounded-[7px] bg-white px-5 py-4 shadow-[0_18px_45px_rgba(32,50,89,0.14)] lg:block">
              <p className="text-sm text-[#30394d]">Bạn vừa nhận đánh giá mới</p>
              <Link href="/dashboard" className="mt-2 inline-block text-sm text-[#22ab59] underline">
                Mở đánh giá
              </Link>
            </div>
          </div>

          <p className="flex max-w-[520px] items-start gap-4 text-xl italic leading-tight text-black lg:col-start-2">
            <CheckCircle2 className="mt-1 size-6 shrink-0 text-[#22ab59]" aria-hidden="true" />
            Tiếp cận cộng tác viên thật để xử lý nhiệm vụ nhỏ, nhận bằng chứng và quản lý thanh
            toán trong một nơi.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1090px] px-6 py-24">
        <h2 className="text-[44px] font-black leading-tight text-[#30394d]">
          Duyệt danh mục việc phổ biến
        </h2>
        <div className="mt-9 grid gap-4 md:grid-cols-4">
          {categories.map((category) => (
            <Link
              href="/marketplace"
              key={category}
              className="rounded-[7px] border border-[#f0f2f5] bg-white p-5 font-bold text-[#203259] shadow-sm hover:border-[#22ab59] hover:text-[#22ab59]"
              onClick={() =>
                posthog.capture("landing_category_clicked", { category })
              }
            >
              {category}
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-[#f0f2f5] bg-[#f5f7fa]">
        <div className="mx-auto grid max-w-[1090px] gap-6 px-6 py-16 md:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label}>
              <div className="text-[42px] font-black text-[#22ab59]">{stat.value}</div>
              <div className="mt-1 text-base font-bold text-[#30394d]">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto flex max-w-[1090px] flex-col gap-6 px-6 py-20 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-4xl font-black text-[#30394d]">Sẵn sàng chạy thử TaskBee?</h2>
          <p className="mt-3 max-w-xl text-lg text-[#686d77]">
            Trang này là bản tạm để khóa phong cách. Các luồng đăng ký, đăng việc và ví tiền sẽ
            được nối ở các giai đoạn tiếp theo.
          </p>
        </div>
        <Link
          href="/register"
          className="inline-flex h-14 items-center justify-center rounded-[7px] bg-[#22ab59] px-8 font-black uppercase text-white hover:bg-[#005924]"
          onClick={() =>
            posthog.capture("landing_browse_tasks_clicked", { location: "bottom_cta" })
          }
        >
          Bắt đầu
        </Link>
      </section>

      <SiteFooter />
    </main>
  );
}
