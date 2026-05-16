import {
  calculateWorkerTaskIntervalSeconds,
  getSubmitTaskCooldownRemainingSeconds,
  getWithdrawalIntervalRequirementMessage,
} from "@/lib/services/worker-task-interval";

describe("worker task interval", () => {
  it("giảm interval khi task được đánh giá hài lòng nhưng không xuống dưới 0", () => {
    expect(calculateWorkerTaskIntervalSeconds(180, -10)).toBe(170);
    expect(calculateWorkerTaskIntervalSeconds(5, -10)).toBe(0);
  });

  it("tăng interval khi task không hài lòng hoặc proof spam bị chặn", () => {
    expect(calculateWorkerTaskIntervalSeconds(170, 20)).toBe(190);
    expect(calculateWorkerTaskIntervalSeconds(190, 60)).toBe(250);
  });

  it("tính thời gian chờ còn lại giữa các lần submit task", () => {
    const now = new Date("2026-05-16T10:00:00.000Z");
    const lastTaskCompletedAt = new Date("2026-05-16T09:59:00.000Z");

    expect(
      getSubmitTaskCooldownRemainingSeconds(
        {
          submitTaskIntervalSeconds: 180,
          lastTaskCompletedAt,
        },
        now,
      ),
    ).toBe(120);
  });

  it("trả thông báo yêu cầu interval bằng 0 trước khi rút tiền", () => {
    expect(getWithdrawalIntervalRequirementMessage(30)).toContain("0 giây");
    expect(getWithdrawalIntervalRequirementMessage(30)).toContain("30 giây");
  });
});
