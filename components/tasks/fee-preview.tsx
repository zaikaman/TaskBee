import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVnd, calculateEmployerTaskCharge } from "@/lib/utils/money";
import { Separator } from "@/components/ui/separator";
import { PLATFORM_FEES } from "@/config/app";

interface FeePreviewProps {
  unitPrice: number;
  totalSlots: number;
}

export function FeePreview({ unitPrice, totalSlots }: FeePreviewProps) {
  // If inputs are invalid or 0, we can just display 0
  const normalizedUnitPrice = unitPrice > 0 ? unitPrice.toString() : "0";
  const normalizedSlots = totalSlots > 0 ? totalSlots : 1;
  const showZeros = unitPrice <= 0 || totalSlots <= 0;

  let escrowAmount: string | number = 0;
  let platformFee: string | number = 0;
  let totalCharge: string | number = 0;

  if (!showZeros) {
    try {
      const result = calculateEmployerTaskCharge(normalizedUnitPrice, normalizedSlots);
      escrowAmount = result.escrowAmount;
      platformFee = result.platformFee;
      totalCharge = result.totalCharge;
    } catch (e) {
      // Fallback if calculation fails (e.g. invalid numbers)
    }
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Chi phí dự kiến</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Tổng ngân sách thưởng (x{totalSlots || 0})</span>
            <span className="font-medium text-foreground">
              {formatVnd(showZeros ? 0 : escrowAmount)}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Phí nền tảng ({PLATFORM_FEES.employerTaskCreationRate * 100}%)</span>
            <span className="font-medium text-foreground">
              {formatVnd(showZeros ? 0 : platformFee)}
            </span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between font-semibold">
            <span>Tổng chi phí thanh toán</span>
            <span className="text-primary">
              {formatVnd(showZeros ? 0 : totalCharge)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
