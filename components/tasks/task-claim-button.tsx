"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TaskStatus } from "@/lib/generated/prisma/enums";
import { claimTaskSlot } from "@/lib/services/task";

type TaskClaimButtonProps = {
  taskId: string;
  taskStatus: TaskStatus;
  availableSlots: number;
};

function getHelperMessage(taskStatus: TaskStatus, availableSlots: number) {
  if (taskStatus === TaskStatus.PAUSED) {
    return "Việc này hiện đang tạm dừng nên chưa thể giữ chỗ.";
  }

  if (taskStatus === TaskStatus.COMPLETED) {
    return "Việc này đã hoàn thành nên không còn chỗ để giữ.";
  }

  if (taskStatus === TaskStatus.CANCELLED) {
    return "Việc này đã bị huỷ nên không còn khả dụng.";
  }

  if (availableSlots <= 0) {
    return "Việc này đã hết slot. Hãy quay lại sau hoặc chọn việc khác.";
  }

  return "Giữ chỗ giúp bạn cố định một suất trước khi gửi bằng chứng.";
}

export function TaskClaimButton({ taskId, taskStatus, availableSlots }: TaskClaimButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const canClaim = taskStatus === TaskStatus.ACTIVE && availableSlots > 0;
  const helperMessage = getHelperMessage(taskStatus, availableSlots);

  return (
    <div className="space-y-3">
      <Button
        type="button"
        onClick={() => {
          if (!canClaim) {
            return;
          }

          startTransition(async () => {
            const result = await claimTaskSlot(taskId);

            if (result.ok) {
              toast.success(result.message || "Bạn đã giữ chỗ công việc thành công.");
              router.refresh();
              return;
            }

            toast.error(result.error || "Không thể giữ chỗ công việc lúc này.");
          });
        }}
        disabled={!canClaim || isPending}
        className="bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isPending
          ? "Đang giữ chỗ..."
          : canClaim
            ? "Giữ chỗ công việc"
            : "Không thể giữ chỗ"}
      </Button>

      <p className="max-w-2xl text-sm leading-6 text-slate-600">{helperMessage}</p>
    </div>
  );
}
