"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TaskStatus } from "@/lib/generated/prisma/enums";
import { claimTaskSlot } from "@/lib/services/task";
import { FullSlotErrorState, DuplicateClaimErrorState } from "./error-states";

type TaskClaimButtonProps = {
  taskId: string;
  taskStatus: TaskStatus;
  availableSlots: number;
};

type ClaimError = {
  type: "full-slot" | "duplicate-claim";
  claimStatus?: string;
} | null;

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

function parseClaimError(errorMessage: string): ClaimError {
  // Check for full slot error
  if (
    errorMessage.includes("hết slot") ||
    errorMessage.includes("hết chỗ") ||
    errorMessage.includes("availableSlots")
  ) {
    return { type: "full-slot" };
  }

  // Check for duplicate claim errors with different statuses
  if (errorMessage.includes("đã nhận việc") || errorMessage.includes("đã có claim")) {
    let claimStatus: string | undefined;

    if (errorMessage.includes("CLAIMED") || errorMessage.includes("claim hiện tại")) {
      claimStatus = "CLAIMED";
    } else if (errorMessage.includes("SUBMITTED") || errorMessage.includes("đã gửi bằng chứng")) {
      claimStatus = "SUBMITTED";
    } else if (errorMessage.includes("CANCELLED") || errorMessage.includes("EXPIRED") || errorMessage.includes("lịch sử")) {
      claimStatus = "CANCELLED";
    }

    return { type: "duplicate-claim", claimStatus };
  }

  return null;
}

export function TaskClaimButton({ taskId, taskStatus, availableSlots }: TaskClaimButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [claimError, setClaimError] = useState<ClaimError>(null);

  const canClaim = taskStatus === TaskStatus.ACTIVE && availableSlots > 0;
  const helperMessage = getHelperMessage(taskStatus, availableSlots);

  // Show error state if there's a claim error
  if (claimError) {
    if (claimError.type === "full-slot") {
      return <FullSlotErrorState />;
    }

    if (claimError.type === "duplicate-claim") {
      return <DuplicateClaimErrorState status={claimError.claimStatus} />;
    }
  }

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
              setClaimError(null);
              router.refresh();
              return;
            }

            // Parse error and show appropriate error state
            const error = parseClaimError(result.error || "");
            if (error) {
              setClaimError(error);
            }

            toast.error(result.error || "Không thể giữ chỗ công việc lúc này.");
          });
        }}
        disabled={!canClaim || isPending}
        className="bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        {isPending
          ? "Đang giữ chỗ..."
          : canClaim
            ? "Giữ chỗ công việc"
            : "Không thể giữ chỗ"}
      </Button>

      <p className="max-w-2xl text-sm leading-6 text-zinc-600">{helperMessage}</p>
    </div>
  );
}
