"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { X, UploadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createSubmission, uploadProofFileAction } from "@/lib/services/submission";
import { DuplicateSubmissionErrorState } from "./error-states";

interface SubmissionFormProps {
  taskId: string;
  proofRequirements?: string | null;
}

type SubmissionError = {
  type: "duplicate-submission";
  submissionStatus?: string;
} | null;

function parseSubmissionError(errorMessage: string): SubmissionError {
  // Check for duplicate submission errors
  if (
    errorMessage.includes("đã gửi bằng chứng") ||
    errorMessage.includes("đã có submission") ||
    errorMessage.includes("đã được duyệt")
  ) {
    let submissionStatus: string | undefined;

    if (errorMessage.includes("PENDING") || errorMessage.includes("chờ duyệt")) {
      submissionStatus = "PENDING";
    } else if (errorMessage.includes("APPROVED") || errorMessage.includes("đã được duyệt")) {
      submissionStatus = "APPROVED";
    }

    return { type: "duplicate-submission", submissionStatus };
  }

  return null;
}

export function SubmissionForm({ taskId, proofRequirements }: SubmissionFormProps) {
  const router = useRouter();
  const [proofText, setProofText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [submissionError, setSubmissionError] = useState<SubmissionError>(null);

  // Show error state if there's a submission error
  if (submissionError?.type === "duplicate-submission") {
    return <DuplicateSubmissionErrorState submissionStatus={submissionError.submissionStatus} />;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const validFiles = files.filter(
        (f) =>
          f.size <= 5 * 1024 * 1024 &&
          ["image/jpeg", "image/png", "image/webp"].includes(f.type)
      );

      if (files.length !== validFiles.length) {
        toast.error("Một số ảnh không hợp lệ (hỗ trợ JPG/PNG/WebP, tối đa 5MB).");
      }

      if (selectedFiles.length + validFiles.length > 5) {
        toast.error("Chỉ được tải lên tối đa 5 ảnh.");
        return;
      }

      setSelectedFiles((prev) => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!proofText.trim() && selectedFiles.length === 0) {
      toast.error("Vui lòng cung cấp mô tả hoặc ít nhất 1 ảnh bằng chứng.");
      return;
    }

    startTransition(async () => {
      setIsUploading(true);
      const uploadedUrls: string[] = [];

      try {
        // 1. Upload files first
        for (const file of selectedFiles) {
          const formData = new FormData();
          formData.append("taskId", taskId);
          formData.append("file", file);

          const res = await uploadProofFileAction({ ok: false }, formData);
          if (!res.ok || !res.url) {
            throw new Error(res.error || "Có lỗi xảy ra khi tải ảnh lên.");
          }
          uploadedUrls.push(res.url);
        }

        // 2. Submit the form
        const submitData = new FormData();
        submitData.append("taskId", taskId);
        if (proofText.trim()) {
          submitData.append("proofText", proofText.trim());
        }
        for (const url of uploadedUrls) {
          submitData.append("proofImages", url);
        }

        const submitRes = await createSubmission({ ok: false }, submitData);

        if (!submitRes.ok) {
          // Parse error and show appropriate error state
          const error = parseSubmissionError(submitRes.error || "");
          if (error) {
            setSubmissionError(error);
            router.refresh();
            return;
          }

          throw new Error(submitRes.error || "Không thể gửi bằng chứng.");
        }

        toast.success(submitRes.message || "Đã gửi bằng chứng thành công!");
        setProofText("");
        setSelectedFiles([]);
        setSubmissionError(null);
        router.refresh();
      } catch (err: any) {
        toast.error(err.message || "Có lỗi xảy ra, vui lòng thử lại.");
      } finally {
        setIsUploading(false);
      }
    });
  };

  return (
    <div id="submit-proof" className="mb-10">
      <div className="flex items-center gap-2 mb-6">
        <div className="bg-[#e7faef] text-[#22ab59] rounded w-5 h-5 flex items-center justify-center font-bold text-xs">
          ?
        </div>
        <h2 className="font-semibold text-base">Gửi bằng chứng của bạn dưới đây</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {proofRequirements ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Yêu cầu bằng chứng</p>
            <p className="mt-2 whitespace-pre-wrap leading-6">{proofRequirements}</p>
          </div>
        ) : null}

        <div className="space-y-4">
          <Label className="text-sm font-medium block">
            Mô tả bằng chứng
          </Label>
          <Textarea
            value={proofText}
            onChange={(e) => setProofText(e.target.value)}
            placeholder="Nhập phần mô tả, nội dung văn bản (tuỳ chọn nếu có ảnh)"
            className="resize-none bg-slate-50 w-full"
            rows={4}
            disabled={isPending || isUploading}
          />
        </div>

        <div className="space-y-4">
          <Label className="text-sm font-medium block">
            Ảnh bằng chứng (Tối đa 5MB/ảnh, tối đa 5 ảnh)
          </Label>
          
          <div className="flex items-center gap-4">
            <Label
              htmlFor="proof-upload"
              className={`flex items-center justify-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-slate-50 transition-colors ${
                isPending || isUploading ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <UploadCloud className="w-5 h-5" />
              <span>Chọn ảnh</span>
            </Label>
            <Input
              id="proof-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={isPending || isUploading || selectedFiles.length >= 5}
            />
            <span className="text-sm text-muted-foreground">
              {selectedFiles.length}/5 ảnh đã chọn
            </span>
          </div>

          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-4 mt-4">
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="relative group rounded-md overflow-hidden bg-slate-100 p-2 border">
                  <p className="text-xs max-w-[120px] truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    disabled={isPending || isUploading}
                    className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded-bl-md opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-6 border-t">
          <Button
            variant="outline"
            type="button"
            className="text-[#22ab59] border-[#22ab59] hover:bg-[#e7faef]"
            disabled={isPending || isUploading}
            onClick={() => {
              setProofText("");
              setSelectedFiles([]);
            }}
          >
            HỦY
          </Button>
          <Button
            type="submit"
            className="bg-[#22ab59] hover:bg-[#01a149] text-white px-8 flex items-center gap-2"
            disabled={isPending || isUploading}
          >
            {(isPending || isUploading) && <Loader2 className="w-4 h-4 animate-spin" />}
            {isUploading ? "ĐANG TẢI LÊN..." : isPending ? "ĐANG XỬ LÝ..." : "GỬI BẰNG CHỨNG"}
          </Button>
        </div>
      </form>
    </div>
  );
}