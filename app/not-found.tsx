import { RouteState } from "@/components/ui/route-state";

export default function NotFound() {
  return (
    <RouteState
      title="Không tìm thấy trang"
      description="Đường dẫn này không tồn tại hoặc đã được di chuyển. Hãy quay lại trang chính để tiếp tục sử dụng TaskBee."
    />
  );
}
