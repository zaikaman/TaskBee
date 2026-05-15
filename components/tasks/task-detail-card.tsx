"use client";

import { formatVnd } from "@/lib/utils/money";
import type { SerializableTask } from "@/lib/utils/task-serialization";

type TaskDetailCardProps = {
  task: Pick<
    SerializableTask,
    | "id"
    | "title"
    | "description"
    | "instructions"
    | "proofRequirements"
    | "category"
    | "rewardAmount"
    | "totalSlots"
    | "availableSlots"
    | "autoApproveDays"
    | "status"
  >;
};

export function TaskDetailCard({ task }: TaskDetailCardProps) {
  return (
    <div className="space-y-8">
      {/* Instructions */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="flex size-4 items-center justify-center bg-[#e7faef] text-xs font-bold text-[#005924]">
            ?
          </div>
          <h2 className="text-sm font-bold text-[#203259]">Những gì được mong đợi ở người làm Freelancer?</h2>
        </div>
        <div className="pl-6">
          <p className="text-sm text-[#203259] whitespace-pre-wrap">{task.instructions}</p>
        </div>
      </div>

      {/* Proof Requirements */}
      {task.proofRequirements && (
        <div>
           <div className="flex items-center gap-2 mb-2">
            <div className="flex size-4 items-center justify-center bg-[#e7faef] text-xs font-bold text-[#005924]">
              ?
            </div>
            <h2 className="text-sm font-bold text-[#203259]">Yêu cầu bằng chứng sau khi hoàn thành công việc?</h2>
          </div>
          <div className="pl-6">
            <p className="text-sm text-[#203259] whitespace-pre-wrap">{task.proofRequirements}</p>
          </div>
        </div>
      )}
    </div>
  );
}
