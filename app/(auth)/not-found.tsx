import { RouteState } from "@/components/ui/route-state";

export default function AuthNotFound() {
  return (
    <RouteState
      title="Không tìm thấy trang xác thực"
      description="Đường dẫn đăng nhập hoặc đăng ký này không tồn tại."
      primaryHref="/login"
      primaryLabel="Về đăng nhập"
    />
  );
}
