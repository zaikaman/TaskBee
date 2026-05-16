import { RouteState } from "@/components/ui/route-state";

export default function DashboardNotFound() {
  return (
    <RouteState
      title="Không tìm thấy mục trong dashboard"
      description="Trang dashboard này không tồn tại hoặc bạn không có quyền truy cập."
      primaryHref="/dashboard/profile"
      primaryLabel="Về hồ sơ"
    />
  );
}
