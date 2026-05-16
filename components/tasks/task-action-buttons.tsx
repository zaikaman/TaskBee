"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { pauseTask, resumeTask, closeTask, cancelTask } from "@/lib/services/task";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type TaskActionButtonsProps = {
  taskId: string;
  status: string;
};

export function TaskActionButtons({ taskId, status }: TaskActionButtonsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const handlePause = () => {
    startTransition(async () => {
      const result = await pauseTask(taskId);
      if (result.ok) {
        setMessage({ type: "success", text: result.message || "Công việc đã được tạm dừng" });
        router.refresh();
      } else {
        setMessage({ type: "error", text: result.error || "Không thể tạm dừng công việc" });
      }
    });
  };

  const handleResume = () => {
    startTransition(async () => {
      const result = await resumeTask(taskId);
      if (result.ok) {
        setMessage({ type: "success", text: result.message || "Công việc đã được tiếp tục" });
        router.refresh();
      } else {
        setMessage({ type: "error", text: result.error || "Không thể tiếp tục công việc" });
      }
    });
  };

  const handleClose = () => {
    if (!confirm("Bạn có chắc chắn muốn đóng công việc này? Phần escrow còn lại sẽ được hoàn trả.")) {
      return;
    }

    startTransition(async () => {
      const result = await closeTask(taskId);
      if (result.ok) {
        setMessage({ type: "success", text: result.message || "Công việc đã được đóng" });
        router.refresh();
      } else {
        setMessage({ type: "error", text: result.error || "Không thể đóng công việc" });
      }
    });
  };

  const handleCancel = () => {
    startTransition(async () => {
      const result = await cancelTask(taskId, cancelReason.trim() || undefined);
      if (result.ok) {
        setMessage({ type: "success", text: result.message || "Công việc đã được hủy" });
        setShowCancelDialog(false);
        setCancelReason("");
        router.refresh();
      } else {
        setMessage({ type: "error", text: result.error || "Không thể hủy công việc" });
      }
    });
  };

  const isActive = status === "ACTIVE";
  const isPaused = status === "PAUSED";
  const isCompleted = status === "COMPLETED";
  const isCancelled = status === "CANCELLED";
  const isDraft = status === "DRAFT";

  // Không hiển thị buttons nếu task đã hoàn thành hoặc đã hủy
  if (isCompleted || isCancelled) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#edf4ff] border border-[#203259]/10 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-[#203259] mb-4">Quản lý công việc</h3>

        {isDraft ? (
          <div className="space-y-4">
            <p className="text-sm text-[#7f8aa0]">
              Công việc này đang ở trạng thái bản nháp. Bạn có thể chỉnh sửa cho hoàn thiện rồi đăng lên.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-[#22ab59] text-white hover:bg-[#1a8a47]">
                <Link href={`/dashboard/employer/tasks/${taskId}/edit`}>Chỉnh sửa công việc</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {isActive && (
              <>
                <Button
                  onClick={handlePause}
                  disabled={isPending}
                  className="bg-[#fbbf24] hover:bg-[#f59e0b] text-white"
                >
                  {isPending ? "Đang xử lý..." : "Tạm dừng việc"}
                </Button>
                <Button
                  onClick={handleClose}
                  disabled={isPending}
                  className="bg-[#203259] hover:bg-[#1a2847] text-white"
                >
                  {isPending ? "Đang xử lý..." : "Đóng việc"}
                </Button>
                <Button
                  onClick={() => setShowCancelDialog(true)}
                  disabled={isPending}
                  className="bg-[#e63e46] hover:bg-[#c92a33] text-white"
                >
                  Hủy việc
                </Button>
              </>
            )}

            {isPaused && (
              <>
                <Button
                  onClick={handleResume}
                  disabled={isPending}
                  className="bg-[#22ab59] hover:bg-[#1a8a47] text-white"
                >
                  {isPending ? "Đang xử lý..." : "Tiếp tục việc"}
                </Button>
                <Button
                  onClick={handleClose}
                  disabled={isPending}
                  className="bg-[#203259] hover:bg-[#1a2847] text-white"
                >
                  {isPending ? "Đang xử lý..." : "Đóng việc"}
                </Button>
                <Button
                  onClick={() => setShowCancelDialog(true)}
                  disabled={isPending}
                  className="bg-[#e63e46] hover:bg-[#c92a33] text-white"
                >
                  Hủy việc
                </Button>
              </>
            )}
          </div>
        )}

        {/* Cancel Dialog */}
        {showCancelDialog && (
          <div className="mt-4 p-4 bg-white border border-[#e63e46] rounded-lg">
            <h4 className="text-sm font-semibold text-[#203259] mb-2">Xác nhận hủy công việc</h4>
            <p className="text-sm text-[#7f8aa0] mb-3">
              Phần escrow sẽ được hoàn trả, nhưng phí tạo việc (10%) sẽ không được hoàn lại.
            </p>
            <div className="mb-3">
              <label className="text-sm font-bold text-[#203259] mb-1 block">
                Lý do hủy (không bắt buộc):
              </label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Nhập lý do hủy công việc..."
                className="min-h-[80px]"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCancel}
                disabled={isPending}
                className="bg-[#e63e46] hover:bg-[#c92a33] text-white"
              >
                {isPending ? "Đang xử lý..." : "Xác nhận hủy"}
              </Button>
              <Button
                onClick={() => {
                  setShowCancelDialog(false);
                  setCancelReason("");
                }}
                variant="outline"
                disabled={isPending}
              >
                Đóng
              </Button>
            </div>
          </div>
        )}

        {/* Action descriptions */}
        <div className="mt-4 space-y-2 text-xs text-[#7f8aa0]">
          {isDraft ? (
            <p>
              <strong>Bản nháp:</strong> Chỉnh sửa để cập nhật nội dung, sau đó đăng lên để kích hoạt công việc.
            </p>
          ) : (
            <>
              <p>
                <strong>Tạm dừng:</strong> Công việc sẽ tạm ẩn khỏi marketplace và worker sẽ không thể nhận thêm.
              </p>
              <p>
                <strong>Tiếp tục:</strong> Công việc sẽ hiển thị lại trên marketplace và cho phép nhận thêm.
              </p>
              <p>
                <strong>Đóng:</strong> Hoàn tất công việc, phần escrow còn lại sẽ được hoàn trả.
              </p>
              <p>
                <strong>Hủy:</strong> Hủy công việc, phần escrow sẽ được hoàn trả nhưng phí tạo việc (10%) không được hoàn lại.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === "success"
              ? "bg-[#22ab59] text-white"
              : "bg-[#e63e46] text-white"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
