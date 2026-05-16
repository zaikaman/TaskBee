"use client";

import { useState, useActionState } from "react";
import Image from "next/image";
import { reviewSubmission, type ReviewSubmissionState } from "@/lib/services/submission";
import { formatVnd } from "@/lib/utils/money";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Submission = {
  id: string;
  status: string;
  proofText: string | null;
  proofImages: any;
  employerFeedback: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  worker: {
    id: string;
    email: string;
    username: string | null;
    avatarUrl: string | null;
  };
  claim: {
    id: string;
    status: string;
    claimedAt: Date;
  };
};

type SubmissionReviewListProps = {
  submissions: Submission[];
  taskStatus: string;
};

function SubmissionCard({
  submission,
  canReview,
}: {
  submission: Submission;
  canReview: boolean;
}) {
  const [isReviewing, setIsReviewing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [state, formAction, isPending] = useActionState<ReviewSubmissionState, FormData>(
    reviewSubmission,
    { ok: false }
  );

  const proofImages = submission.proofImages
    ? Array.isArray(submission.proofImages)
      ? submission.proofImages
      : []
    : [];

  const isStatusPending = submission.status === "PENDING";
  const isStatusApproved = submission.status === "APPROVED";
  const isStatusRejected = submission.status === "REJECTED";

  const handleReview = (action: "APPROVE" | "REJECT") => {
    const formData = new FormData();
    formData.append("submissionId", submission.id);
    formData.append("action", action);
    if (feedback.trim()) {
      formData.append("feedback", feedback.trim());
    }
    formAction(formData);
    setIsReviewing(false);
    setFeedback("");
  };

  return (
    <div
      className={`border rounded-lg p-6 ${
        isStatusPending
          ? "border-[#fbbf24] bg-[#fffbeb]"
          : isStatusApproved
            ? "border-[#22ab59] bg-[#f0fdf4]"
            : "border-[#e63e46] bg-[#fef2f2]"
      }`}
    >
      {/* Worker Info */}
      <div className="flex items-center gap-3 mb-4">
        {submission.worker.avatarUrl ? (
          <Image
            src={submission.worker.avatarUrl}
            alt={submission.worker.username || submission.worker.email}
            width={40}
            height={40}
            className="rounded-full"
          />
        ) : (
          <div className="size-10 rounded-full bg-[#203259] flex items-center justify-center text-white font-bold">
            {(submission.worker.username || submission.worker.email)[0].toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-bold text-[#203259]">
            {submission.worker.username || submission.worker.email}
          </p>
          <p className="text-xs text-[#7f8aa0]">
            Submitted {new Date(submission.createdAt).toLocaleDateString("vi-VN")}
          </p>
        </div>
        <div className="ml-auto">
          <span
            className={`inline-block rounded px-3 py-1 text-xs font-bold uppercase ${
              isStatusPending
                ? "bg-[#fbbf24] text-white"
                : isStatusApproved
                  ? "bg-[#22ab59] text-white"
                  : "bg-[#e63e46] text-white"
            }`}
          >
            {isStatusPending ? "Chờ duyệt" : isStatusApproved ? "Đã duyệt" : "Từ chối"}
          </span>
        </div>
      </div>

      {/* Proof Text */}
      {submission.proofText && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-[#203259] mb-2">Mô tả bằng chứng:</h4>
          <div className="bg-white p-3 rounded border border-[#203259]/10">
            <p className="text-sm text-[#203259] whitespace-pre-wrap">{submission.proofText}</p>
          </div>
        </div>
      )}

      {/* Proof Images */}
      {proofImages.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-[#203259] mb-2">Hình ảnh bằng chứng:</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {proofImages.map((url: string, index: number) => (
              <a
                key={index}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative aspect-video rounded overflow-hidden border border-[#203259]/10 hover:opacity-80 transition-opacity"
              >
                <Image
                  src={url}
                  alt={`Proof ${index + 1}`}
                  fill
                  className="object-cover"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Employer Feedback */}
      {submission.employerFeedback && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-[#203259] mb-2">Phản hồi của bạn:</h4>
          <div className="bg-white p-3 rounded border border-[#203259]/10">
            <p className="text-sm text-[#203259] whitespace-pre-wrap">
              {submission.employerFeedback}
            </p>
          </div>
        </div>
      )}

      {/* Review Actions */}
      {isStatusPending && canReview && (
        <div className="mt-4">
          {!isReviewing ? (
            <div className="flex gap-2">
              <Button
                onClick={() => setIsReviewing(true)}
                className="bg-[#22ab59] hover:bg-[#1a8a47] text-white"
              >
                Duyệt
              </Button>
              <Button
                onClick={() => setIsReviewing(true)}
                className="bg-[#e63e46] hover:bg-[#c92a33] text-white"
              >
                Từ chối
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-bold text-[#203259] mb-1 block">
                  Phản hồi (tùy chọn):
                </label>
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Nhập phản hồi cho worker..."
                  className="min-h-[80px]"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleReview("APPROVE")}
                  disabled={isPending}
                  className="bg-[#22ab59] hover:bg-[#1a8a47] text-white"
                >
                  {isPending ? "Đang xử lý..." : "Xác nhận duyệt"}
                </Button>
                <Button
                  onClick={() => handleReview("REJECT")}
                  disabled={isPending}
                  className="bg-[#e63e46] hover:bg-[#c92a33] text-white"
                >
                  {isPending ? "Đang xử lý..." : "Xác nhận từ chối"}
                </Button>
                <Button
                  onClick={() => {
                    setIsReviewing(false);
                    setFeedback("");
                  }}
                  variant="outline"
                  disabled={isPending}
                >
                  Hủy
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Review Result Message */}
      {state.ok && state.message && (
        <div className="mt-4 p-3 bg-[#22ab59] text-white rounded text-sm">
          {state.message}
        </div>
      )}
      {!state.ok && state.error && (
        <div className="mt-4 p-3 bg-[#e63e46] text-white rounded text-sm">
          {state.error}
        </div>
      )}
    </div>
  );
}

export function SubmissionReviewList({
  submissions,
  taskStatus,
}: SubmissionReviewListProps) {
  const canReview = taskStatus === "ACTIVE";

  // Sắp xếp: PENDING lên đầu, sau đó theo thời gian
  const sortedSubmissions = [...submissions].sort((a, b) => {
    if (a.status === "PENDING" && b.status !== "PENDING") {
      return -1;
    }
    if (a.status !== "PENDING" && b.status === "PENDING") {
      return 1;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="space-y-4">
      {!canReview && (
        <div className="bg-[#fff6f6] border border-[#e63e46] p-4 rounded-lg">
          <p className="text-sm text-[#e63e46]">
            <strong>Lưu ý:</strong> Task này không ở trạng thái ACTIVE nên không thể review submissions.
          </p>
        </div>
      )}
      {sortedSubmissions.map((submission) => (
        <SubmissionCard
          key={submission.id}
          submission={submission}
          canReview={canReview}
        />
      ))}
    </div>
  );
}
