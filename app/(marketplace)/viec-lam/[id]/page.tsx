import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Lock, Info, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { formatVnd } from "@/lib/utils/money";

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  // In a real implementation: fetch the task details using params.id
  // const task = await getTaskById(params.id);

  const mockTask = {
    id: params.id,
    title: "App: Install 💙 + Xác minh khuôn mặt (Kiếm tiền dễ dàng 💸)",
    reward: 20000,
    availableSlots: 25,
    completedSlots: 11,
    employerName: "Người thuê ẩn danh",
    category: "Ứng dụng Di động (iPhone & Android)",
    createdAt: "1 năm trước",
    timeToRate: "2 ngày",
    instructions: [
      "Đi đến: https://play.google.com/store/apps/details?id=com.xd.metapass",
      "Tải ứng dụng từ liên kết",
      "Đăng ký và nhập mã giới thiệu của tôi, nếu không tôi sẽ không trả tiền. (Chụp ảnh màn hình khi bạn nhập mã)",
      "Mã giới thiệu: 2sz4uu6s",
      "Sau khi đăng ký, yêu cầu xác minh khuôn mặt. Hãy hoàn thành chính xác hoặc vào phần Xác minh để hoàn tất KYC.",
      "Nếu bạn không hiểu, hãy xem video hướng dẫn này: https://youtu.be/..."
    ],
    proofRequirements: [
      { id: 1, type: "image", description: "Ảnh chụp màn hình sử dụng mã giới thiệu: 2sz4uu6s" },
      { id: 2, type: "image", description: "Ảnh chụp màn hình tùy chọn ID trong ứng dụng (sau khi xác minh khuôn mặt)" },
      { id: 3, type: "text", description: "Gửi địa chỉ mec của bạn" },
      { id: 4, type: "image", description: "Nếu xác minh hoàn tất, vui lòng cung cấp ảnh chụp màn hình." }
    ]
  };

  return (
    <div className="container max-w-4xl py-8">
      {/* Banner / Notice */}
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md mb-6 flex items-start text-sm">
        <Info className="w-5 h-5 mr-3 shrink-0 text-yellow-600" />
        <p>
          Cải thiện bảo mật tài khoản của bạn. Thêm email khôi phục ngay để đảm bảo quyền truy cập liên tục.
        </p>
      </div>

      <Link href="/viec-lam" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Quay lại
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1b1b1b] mb-2">{mockTask.title}</h1>
          <p className="text-sm text-muted-foreground">Quốc tế - Toàn thế giới</p>
        </div>
        <div className="text-3xl font-bold tracking-tight text-[#1b1b1b]">
          {formatVnd(mockTask.reward)}
        </div>
      </div>

      {/* Action Banner */}
      <div className="bg-[#e7faef] rounded-md p-4 flex flex-col sm:flex-row items-center justify-between mb-8">
        <p className="font-medium text-[#005924] mb-3 sm:mb-0">Đã hoàn thành công việc? Gửi bằng chứng!</p>
        <div className="flex items-center gap-4">
          <Link href="#submit-proof" className="text-sm text-[#22ab59] hover:underline font-medium">Báo cáo công việc</Link>
          <Link href="#submit-proof" className="text-sm text-[#22ab59] hover:underline font-medium">Chặn người thuê</Link>
          <Button className="bg-[#22ab59] hover:bg-[#01a149] text-white">Gửi bằng chứng</Button>
        </div>
      </div>

      {/* Job Details Grid */}
      <Card className="mb-8 border-none shadow-sm bg-slate-50">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
            <div>
              <p className="text-sm font-semibold mb-1">Các quốc gia bị loại trừ</p>
              <p className="text-sm text-muted-foreground">—</p>
            </div>
            <div>
              <p className="text-sm font-semibold mb-1">Đã hoàn thành</p>
              <p className="text-sm text-muted-foreground">{mockTask.completedSlots} trên {mockTask.availableSlots}</p>
            </div>
            <div>
              <p className="text-sm font-semibold mb-1">Người thuê</p>
              <div className="flex items-center text-sm text-muted-foreground">
                <Lock className="w-3 h-3 mr-1" />
                Đã bị ẩn
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-1">Thời gian duyệt</p>
              <p className="text-sm text-muted-foreground">{mockTask.timeToRate}</p>
            </div>
            <div>
              <p className="text-sm font-semibold mb-1">Mã công việc</p>
              <p className="text-sm text-muted-foreground text-[#a8b0bf]">Gửi bài để xem</p>
            </div>
            <div>
              <p className="text-sm font-semibold mb-1">Danh mục</p>
              <p className="text-sm text-[#22ab59] hover:underline cursor-pointer">{mockTask.category}</p>
            </div>
            <div>
              <p className="text-sm font-semibold mb-1">Tham gia từ</p>
              <p className="text-sm text-muted-foreground">{mockTask.createdAt}</p>
            </div>
            <div>
              <p className="text-sm font-semibold mb-1">Thống kê người thuê</p>
              <Lock className="w-3 h-3 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hold Job */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="bg-[#e7faef] text-[#22ab59] rounded w-5 h-5 flex items-center justify-center font-bold text-xs">?</div>
          <p className="font-semibold text-sm">Bạn có muốn giữ chỗ không? Giữ chỗ không bắt buộc nhưng được khuyến khích.</p>
        </div>
        <Button className="bg-[#22ab59] hover:bg-[#01a149] text-white">GIỮ CHỖ CÔNG VIỆC</Button>
      </div>

      {/* Instructions */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-[#e7faef] text-[#22ab59] rounded w-5 h-5 flex items-center justify-center font-bold text-xs">?</div>
          <h2 className="font-semibold text-base">Yêu cầu công việc chi tiết</h2>
        </div>
        <ol className="list-decimal list-inside space-y-3 pl-2 text-sm text-slate-700">
          {mockTask.instructions.map((step, idx) => (
            <li key={idx} className="leading-relaxed whitespace-pre-wrap">{step}</li>
          ))}
        </ol>
        <div className="mt-6 text-sm text-slate-700">
          <p className="font-medium mb-1">Lưu ý:</p>
          <p>Sẽ không ai được gửi bài cho đến khi xác minh thành công. Nếu không, bài sẽ bị đánh giá Không đạt.</p>
        </div>
      </div>

      {/* Proof Requirements */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-[#e7faef] text-[#22ab59] rounded w-5 h-5 flex items-center justify-center font-bold text-xs">?</div>
          <h2 className="font-semibold text-base">Bằng chứng yêu cầu</h2>
        </div>
        <ol className="list-decimal list-inside space-y-3 pl-2 text-sm text-slate-700">
          {mockTask.proofRequirements.map((proof, idx) => (
            <li key={idx}>{proof.description}</li>
          ))}
        </ol>
      </div>

      <hr className="my-8" />

      {/* Submit Proofs Form */}
      <div id="submit-proof" className="mb-10">
        <div className="flex items-center gap-2 mb-6">
          <div className="bg-[#e7faef] text-[#22ab59] rounded w-5 h-5 flex items-center justify-center font-bold text-xs">?</div>
          <h2 className="font-semibold text-base">Gửi bằng chứng của bạn dưới đây</h2>
        </div>

        <form className="space-y-8">
          {mockTask.proofRequirements.map((proof, idx) => (
            <div key={idx} className="space-y-3">
              <Label className="text-sm font-medium">
                {idx + 1}. {proof.description} {proof.type === 'image' && <span className="text-muted-foreground font-normal">- tải ảnh lên (Tối đa 2MB)</span>}
              </Label>
              
              {proof.type === 'image' ? (
                <div className="space-y-3">
                  <Input type="file" accept="image/*" className="max-w-md bg-slate-50 cursor-pointer" />
                  <p className="text-xs text-muted-foreground">Tùy chọn, thêm bình luận. (Vui lòng không gửi link, chỉ tải ảnh lên)</p>
                  <Textarea placeholder="Nhập bình luận của bạn vào đây" className="resize-none bg-slate-50" rows={3} />
                </div>
              ) : (
                <Textarea placeholder="Nhập văn bản bằng chứng vào đây" className="resize-none bg-slate-50" rows={3} />
              )}
            </div>
          ))}

          <div className="flex items-center justify-between pt-6 border-t">
            <Button variant="outline" type="button" className="text-[#22ab59] border-[#22ab59] hover:bg-[#e7faef]">HỦY</Button>
            <Button type="button" className="bg-[#22ab59] hover:bg-[#01a149] text-white px-8">GỬI BẰNG CHỨNG</Button>
          </div>
        </form>
      </div>

    </div>
  );
}
