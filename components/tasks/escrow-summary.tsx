import { Card, CardContent } from "@/components/ui/card";
import { formatVnd } from "@/lib/utils/money";
import { ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

interface EscrowSummaryProps {
  escrowAmount: number | string;
  releasedAmount: number | string;
  remainingAmount: number | string;
}

export function EscrowSummary({
  escrowAmount,
  releasedAmount,
  remainingAmount,
}: EscrowSummaryProps) {
  return (
    <div className="space-y-4">
      <Alert className="bg-primary/5 border-primary/20">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <AlertTitle className="text-primary font-medium">Ký quỹ an toàn</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          Số tiền này được TaskBee giữ an toàn và chỉ thanh toán cho người làm khi bạn duyệt kết quả thành công.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tổng ký quỹ ban đầu</span>
            <span className="font-medium">{formatVnd(escrowAmount)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Đã thanh toán</span>
            <span className="font-medium text-emerald-600">
              {formatVnd(releasedAmount)}
            </span>
          </div>
          <Separator className="my-1" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Đang khoá chờ duyệt</span>
            <span className="font-semibold text-primary">
              {formatVnd(remainingAmount)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
