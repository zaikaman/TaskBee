import { RouteState } from "@/components/ui/route-state";

export default function AdminNotFound() {
  return (
    <RouteState
      title="Không tìm thấy trang admin"
      description="Trang quản trị này không tồn tại hoặc tài khoản hiện tại không có quyền truy cập."
      primaryHref="/admin/dashboard"
      primaryLabel="Về admin"
    />
  );
}
