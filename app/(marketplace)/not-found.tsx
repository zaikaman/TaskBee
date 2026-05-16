import { RouteState } from "@/components/ui/route-state";

export default function MarketplaceNotFound() {
  return (
    <RouteState
      title="Không tìm thấy việc"
      description="Việc này không tồn tại, đã bị đóng hoặc không còn hiển thị công khai."
      primaryHref="/marketplace"
      primaryLabel="Xem việc khác"
    />
  );
}
