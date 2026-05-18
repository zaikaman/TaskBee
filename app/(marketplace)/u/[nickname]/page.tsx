import type { Metadata } from "next";
import Link from "next/link";
import { Info, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  freelancerPointRules,
  getPublicFreelancerStats,
  getPublicProfileByNickname,
  type PublicFreelancerStats,
} from "@/lib/services/public-profile";
import { formatVnd } from "@/lib/utils/money";

type UserProfilePageProps = {
  params: Promise<{
    nickname: string;
  }>;
};

export async function generateMetadata({ params }: UserProfilePageProps): Promise<Metadata> {
  const { nickname } = await params;
  const profile = await getPublicProfileByNickname(nickname);

  if (!profile?.username) {
    return {
      title: "Không tìm thấy hồ sơ | TaskBee",
    };
  }

  return {
    title: `${profile.username} | TaskBee`,
    description: `Hồ sơ công khai của ${profile.username} trên TaskBee.`,
  };
}

export default async function UserProfilePage({ params }: UserProfilePageProps) {
  const { nickname } = await params;
  const profile = await getPublicProfileByNickname(nickname);

  if (!profile?.username) {
    notFound();
  }

  const stats = await getPublicFreelancerStats(profile);
  const joinedMonth = new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
  }).format(profile.createdAt);

  return (
    <div className="mx-auto max-w-[1048px] space-y-8 bg-white pt-3 font-sans text-[#001f52]">
      <ImportantWorkAlert />

      <section className="grid items-start gap-10 pt-6 lg:grid-cols-[272px_1fr]">
        <aside className="space-y-2">
          <ProfileSummaryCard
            avatarUrl={profile.avatarUrl}
            username={profile.username}
            publicId={profile.id.slice(0, 8)}
            joinedMonth={joinedMonth}
          />
          <Button
            asChild
            variant="ghost"
            className="h-8 w-full rounded-none bg-[#f5f7fa] text-sm font-bold uppercase text-[#00a651] hover:bg-[#eef2f6] hover:text-[#008d45]"
          >
            <Link href="/referrals">Chia sẻ & nhận thưởng</Link>
          </Button>
        </aside>

        <main className="space-y-6">
          <ProfileTabs />

          <section className="grid items-start gap-5 xl:grid-cols-[1fr_360px]">
            <div className="space-y-5">
              <FreelancerPerformanceCard stats={stats} />
              <SuccessRateCard
                title="Tỷ lệ thành công mọi thời điểm"
                value={stats.allTimeSuccessRate}
                muted
                tooltip="Tỷ lệ thành công mọi thời điểm là phần trăm task được đánh giá hài lòng trên tổng số task đã hoàn tất."
              />
              <SuccessRateCard
                title="Tỷ lệ thành công tạm thời"
                value={stats.temporarySuccessRate}
                tooltip="Người làm cần giữ tỷ lệ thành công tạm thời từ 75% trở lên trong 50 ngày gần nhất."
                footer={stats.canSubmitTasks ? "Có thể gửi task" : "Tạm thời chưa thể gửi task"}
              />
            </div>

            <FreelancerLevelCard stats={stats} />
          </section>
        </main>
      </section>
    </div>
  );
}

function ImportantWorkAlert() {
  return (
    <div className="flex items-start justify-between gap-4 rounded bg-[#d9f3f7] px-4 py-3 text-sm leading-6 text-[#004258]">
      <div className="flex gap-3">
        <Info className="mt-1 size-4 shrink-0 text-[#22ab59]" aria-hidden="true" />
        <p className="font-medium">
          Quan trọng: mọi công việc trên TaskBee cần được hoàn thành độc lập, đúng yêu cầu và không chia sẻ nhiệm vụ.
        </p>
      </div>
      <span className="text-base leading-5" aria-hidden="true">
        ×
      </span>
    </div>
  );
}

function ProfileSummaryCard({
  avatarUrl,
  username,
  publicId,
  joinedMonth,
}: {
  avatarUrl: string | null;
  username: string;
  publicId: string;
  joinedMonth: string;
}) {
  return (
    <article className="bg-[#f5f7fa] px-6 py-6 text-center text-sm">
      <div className="mx-auto flex size-32 items-center justify-center overflow-hidden border border-[#a8b0bf] bg-white">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={username} className="h-full w-full object-cover" />
        ) : (
          <UserRound className="size-24 text-[#a8b0bf]" aria-hidden="true" />
        )}
      </div>

      <h1 className="mt-4 text-lg font-bold text-[#001f52]">{username}</h1>
      <p className="mt-2 text-sm font-medium text-[#686d77]">#{publicId}</p>
      <p className="mt-7 font-semibold text-[#686d77]">Việt Nam</p>

      <div className="mt-7 grid grid-cols-2 gap-y-5">
        <ProfileMetric label="Tham gia" value={joinedMonth} />
        <ProfileMetric label="Truy cập cuối" value="Đang online" />
        <ProfileMetric label="Đang theo dõi" value="0" />
        <ProfileMetric label="Người theo dõi" value="0" />
      </div>
    </article>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <p className="font-semibold text-[#686d77]">{label}</p>
      <p className="font-bold text-black">{value}</p>
    </div>
  );
}

function ProfileTabs() {
  return (
    <section className="border-b border-[#d3dae6]">
      <div className="grid grid-cols-2 text-sm font-bold uppercase">
        <span className="border-b-2 border-[#22ab59] pb-5 text-[#001f52]">Công việc nhỏ của tôi</span>
        <span className="pb-5 text-right text-[#001f52]">Đánh giá Gig</span>
      </div>
    </section>
  );
}

function FreelancerPerformanceCard({ stats }: { stats: PublicFreelancerStats }) {
  return (
    <article className="bg-white p-8 shadow-[0_1px_8px_rgba(0,0,0,0.08)] ring-1 ring-zinc-100">
      <h2 className="text-base font-semibold text-[#001f52]">Hiệu suất người làm</h2>
      <div className="mt-6 grid gap-x-12 gap-y-4 text-sm sm:grid-cols-2">
        <StatRow label="Task đã làm" value={stats.tasksDone.toLocaleString("vi-VN")} />
        <StatRow label="Đã kiếm" value={formatVnd(stats.earned)} />
        <StatRow label="Hài lòng" value={stats.satisfied.toLocaleString("vi-VN")} />
        <StatRow label="Đã kiếm/Task" value={formatVnd(stats.earnedPerTask)} />
        <StatRow label="Không hài lòng" value={stats.notSatisfied.toLocaleString("vi-VN")} />
        <StatRow label="Gửi task gần nhất" value={stats.lastTaskSubmittedLabel} />
      </div>
    </article>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-semibold text-black">{label}</span>
      <span className="text-right font-bold text-[#00a651]">{value}</span>
    </div>
  );
}

function SuccessRateCard({
  title,
  value,
  tooltip,
  footer,
  muted = false,
}: {
  title: string;
  value: number;
  tooltip: string;
  footer?: string;
  muted?: boolean;
}) {
  const color = muted ? "#d6deeb" : "#22ab59";

  return (
    <article className="min-h-[266px] bg-white p-8 shadow-[0_1px_8px_rgba(0,0,0,0.08)] ring-1 ring-zinc-100">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-[#001f52]">{title}</h2>
        <span className="group relative inline-flex">
          <Info className="size-4 text-[#001f52]" aria-hidden="true" />
          <span className="pointer-events-none absolute bottom-6 left-1/2 z-10 w-64 -translate-x-1/2 bg-[#1b1b1b] px-3 py-2 text-center text-xs font-semibold leading-5 text-white opacity-0 shadow-lg transition group-hover:opacity-100">
            {tooltip}
          </span>
        </span>
      </div>

      <div className="mt-7 flex flex-col items-center">
        <div
          className="flex size-[114px] items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(${color} ${value * 3.6}deg, #d6deeb 0deg)`,
          }}
        >
          <div className="flex size-[92px] flex-col items-center justify-center rounded-full bg-white text-center">
            <span className="text-base font-bold text-[#001f52]">{value}%</span>
            <span className="mt-1 text-xs text-[#001f52]">Tỷ lệ</span>
          </div>
        </div>
        {footer ? <p className="mt-7 text-sm font-semibold text-[#001f52]">{footer}</p> : null}
      </div>
    </article>
  );
}

function FreelancerLevelCard({ stats }: { stats: PublicFreelancerStats }) {
  return (
    <article className="bg-white p-8 shadow-[0_1px_8px_rgba(0,0,0,0.08)] ring-1 ring-zinc-100">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-[#001f52]">Cấp người làm</h2>
        <span className="bg-[#d8f0df] px-2 py-1 text-xs font-bold uppercase text-[#107b35]">
          LEVEL {stats.level} &lt; {stats.levelName} &gt;
        </span>
      </div>

      <div className="mt-6 space-y-5 text-sm leading-6 text-black">
        <p>
          Cấp người làm quyết định cấp độ công việc bạn có thể nhận trên TaskBee. Cấp càng cao, bạn càng có thể truy cập các công việc có mức thưởng tốt hơn.
        </p>
        <p>
          Cấp độ được xác định dựa trên tổng điểm tích lũy. Bạn nhận điểm cho mỗi task được đánh giá hài lòng và cho doanh thu kiếm được từ task.
        </p>
        <p>
          Cấp độ có thể giảm nếu không hoạt động trong thời gian dài hoặc có task bị đánh giá không hài lòng.
        </p>
        <p>Tiếp tục hoàn thành tốt task để lên cấp và mở khóa nhiều công việc hơn.</p>
      </div>

      <div className="mt-6 overflow-hidden text-sm">
        <div className="grid grid-cols-[1fr_96px] bg-[#f0f3f7] font-bold text-[#001f52]">
          <div className="p-3">Quy tắc</div>
          <div className="p-3 text-center">Điểm</div>
        </div>
        {freelancerPointRules.map((item) => (
          <div key={item.rule} className="mt-1 grid grid-cols-[1fr_96px] bg-[#f0f3f7] text-black">
            <div className="p-3">{item.rule}</div>
            <div className="p-3 text-center">{item.points}</div>
          </div>
        ))}
      </div>
    </article>
  );
}
