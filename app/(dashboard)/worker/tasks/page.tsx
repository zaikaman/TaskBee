import { Info, AlertCircle, CheckCircle2, Clock, Check, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { formatVnd } from "@/lib/utils/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Nhiệm vụ đã hoàn thành | Worker Dashboard",
};

// Mock data
const mockTasks = [
  {
    id: "1",
    status: "PENDING",
    name: "Twitter: Update Profile + Like + Rt+ Comment",
    date: "1 ngày trước",
    earned: 400,
  },
  {
    id: "2",
    status: "APPROVED",
    name: "SEO + Promote Content + Engage Qualificated",
    date: "1 ngày trước",
    earned: 600,
  },
  {
    id: "3",
    status: "APPROVED",
    name: "SEO + Promote Content + Engage 1x",
    date: "2 tuần trước",
    earned: 400,
  },
  {
    id: "4",
    status: "APPROVED",
    name: "Facebook: Share + Like + Comment",
    date: "3 tuần trước",
    earned: 300,
  },
  {
    id: "5",
    status: "APPROVED",
    name: "Reddit: Upvote + Comment",
    date: "1 tháng trước",
    earned: 200,
  },
];

export default function WorkerTasksPage() {
  return (
    <div className="container max-w-6xl py-8">
      {/* Security Banner */}
      <div className="bg-[#fff3cf] border border-[#de9100] text-[#de9100] px-4 py-3 rounded-md mb-6 flex items-start text-sm">
        <AlertCircle className="size-5 mr-3 shrink-0" />
        <div className="flex-1">
          <span className="font-medium">Cải thiện bảo mật tài khoản của bạn.</span> Thêm email khôi phục ngay để đảm bảo quyền truy cập liên tục. Bảo vệ tài khoản của bạn trong trường hợp mất email chính.{" "}
          <Link href="/dashboard/profile" className="font-semibold text-[#de9100] hover:underline">
            Đến Cài đặt tài khoản &gt; Bảo mật
          </Link>
        </div>
        <button className="text-[#de9100] hover:text-[#b37500] ml-3 text-lg font-bold">×</button>
      </div>

      <h1 className="text-2xl font-semibold text-[#203259] mb-6">Nhiệm vụ đã hoàn thành</h1>

      {/* Warning Banner */}
      <div className="bg-[#fce3e5] border border-[#e63e46] text-[#e63e46] px-4 py-3 rounded-md mb-6 flex items-center text-sm font-medium">
        <AlertCircle className="size-4 mr-2 shrink-0" />
        Nhiệm vụ cũ hơn 6 tháng không còn khả dụng.
      </div>

      {/* Search Input */}
      <div className="flex justify-end mb-4">
        <div className="w-full md:w-80">
          <Input 
            placeholder="Nhập và nhấn enter để tìm kiếm..." 
            className="bg-zinc-50 border-zinc-200"
          />
        </div>
      </div>

      {/* Filters & Count */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4 text-sm font-medium text-[#203259]">
        <div>{mockTasks.length} kết quả</div>
        <div className="flex items-center gap-4">
          <div className="flex items-center">
            <span className="mr-2">Lọc theo /</span>
            <Select defaultValue="all">
              <SelectTrigger className="w-[180px] h-8 border-none bg-transparent shadow-none px-2 font-bold p-0">
                <SelectValue placeholder="Tất cả nhiệm vụ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả nhiệm vụ</SelectItem>
                <SelectItem value="pending">Đang chờ</SelectItem>
                <SelectItem value="approved">Đã duyệt</SelectItem>
                <SelectItem value="rejected">Bị từ chối</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center">
            <span className="mr-2">Sắp xếp theo /</span>
            <Select defaultValue="recent">
              <SelectTrigger className="w-[150px] h-8 border-none bg-transparent shadow-none px-2 font-bold p-0">
                <SelectValue placeholder="Gần đây nhất" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Gần đây nhất</SelectItem>
                <SelectItem value="earned">Thu nhập</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border border-zinc-200 rounded-md overflow-hidden bg-white mb-6">
        <Table>
          <TableHeader className="bg-zinc-50">
            <TableRow className="hover:bg-zinc-50">
              <TableHead className="w-[80px] font-bold text-center text-[#203259]">Trạng thái</TableHead>
              <TableHead className="font-bold text-[#203259]">Tên công việc</TableHead>
              <TableHead className="w-[150px] font-bold text-[#203259]">Ngày</TableHead>
              <TableHead className="w-[150px] font-bold text-[#203259]">Thu nhập</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockTasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell className="text-center">
                  {task.status === "PENDING" && (
                    <div className="inline-flex size-6 rounded-full bg-[#fff3cf] text-[#de9100] items-center justify-center">
                      <MoreHorizontal className="size-3" />
                    </div>
                  )}
                  {task.status === "APPROVED" && (
                    <div className="inline-flex size-6 rounded-full bg-[#e7faef] text-[#22ab59] items-center justify-center">
                      <Check className="size-3 stroke-[3]" />
                    </div>
                  )}
                  {task.status === "REJECTED" && (
                    <div className="inline-flex size-6 rounded-full bg-[#fce3e5] text-[#e63e46] items-center justify-center">
                      <AlertCircle className="size-3" />
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium text-[#203259]">
                  <Link href={`/marketplace/${task.id}`} className="hover:underline hover:text-[#22ab59]">
                    {task.name}
                  </Link>
                </TableCell>
                <TableCell className="text-zinc-500">{task.date}</TableCell>
                <TableCell className="font-medium text-[#203259]">{formatVnd(task.earned)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex justify-center mb-10">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-8 rounded text-zinc-400 border-zinc-200" disabled>
            &lt;
          </Button>
          <Button variant="outline" size="icon" className="size-8 rounded border-[#22ab59] bg-[#e7faef] text-[#22ab59] hover:bg-[#e7faef] hover:text-[#22ab59] font-medium">
            1
          </Button>
          <Button variant="ghost" size="icon" className="size-8 rounded font-medium hover:bg-zinc-100 text-[#203259]">
            2
          </Button>
          <Button variant="ghost" size="icon" className="size-8 rounded font-medium hover:bg-zinc-100 text-[#203259]">
            3
          </Button>
          <Button variant="ghost" size="icon" className="size-8 rounded font-medium hover:bg-zinc-100 text-[#203259]">
            4
          </Button>
          <Button variant="ghost" size="icon" className="size-8 rounded font-medium hover:bg-zinc-100 text-[#203259]">
            5
          </Button>
          <span className="px-2 text-zinc-500">...</span>
          <Button variant="ghost" size="icon" className="size-8 rounded font-medium hover:bg-zinc-100 text-[#203259]">
            27
          </Button>
          <Button variant="outline" size="icon" className="size-8 rounded text-[#203259] border-zinc-200 hover:bg-zinc-50">
            &gt;
          </Button>
        </div>
      </div>
      
      <div className="flex justify-center">
        <Button className="bg-[#22ab59] hover:bg-[#01a149] text-white px-8">
          Tìm Việc
        </Button>
      </div>

    </div>
  );
}
