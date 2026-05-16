import { AlertCircle, Clock, CheckCircle2, XCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type ErrorStateVariant = "info" | "warning" | "error" | "success";

interface BaseErrorStateProps {
  variant?: ErrorStateVariant;
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

function getVariantStyles(variant: ErrorStateVariant) {
  switch (variant) {
    case "info":
      return {
        container: "border-blue-200 bg-blue-50",
        icon: "text-blue-600",
        title: "text-blue-900",
        description: "text-blue-700",
        iconBg: "bg-blue-100",
      };
    case "warning":
      return {
        container: "border-amber-200 bg-amber-50",
        icon: "text-amber-600",
        title: "text-amber-900",
        description: "text-amber-700",
        iconBg: "bg-amber-100",
      };
    case "error":
      return {
        container: "border-red-200 bg-red-50",
        icon: "text-red-600",
        title: "text-red-900",
        description: "text-red-700",
        iconBg: "bg-red-100",
      };
    case "success":
      return {
        container: "border-emerald-200 bg-emerald-50",
        icon: "text-emerald-600",
        title: "text-emerald-900",
        description: "text-emerald-700",
        iconBg: "bg-emerald-100",
      };
    default:
      return {
        container: "border-zinc-200 bg-zinc-50",
        icon: "text-zinc-600",
        title: "text-zinc-900",
        description: "text-zinc-700",
        iconBg: "bg-zinc-100",
      };
  }
}

function getDefaultIcon(variant: ErrorStateVariant) {
  switch (variant) {
    case "info":
      return <Info className="size-5" />;
    case "warning":
      return <AlertCircle className="size-5" />;
    case "error":
      return <XCircle className="size-5" />;
    case "success":
      return <CheckCircle2 className="size-5" />;
    default:
      return <Info className="size-5" />;
  }
}

export function ErrorState({
  variant = "info",
  title,
  description,
  icon,
  action,
}: BaseErrorStateProps) {
  const styles = getVariantStyles(variant);
  const displayIcon = icon || getDefaultIcon(variant);

  return (
    <Alert className={`${styles.container} border shadow-sm`}>
      <div className="flex items-start gap-4">
        <div className={`${styles.iconBg} p-2 rounded-full ${styles.icon} shrink-0 mt-0.5`}>
          {displayIcon}
        </div>
        <div className="flex-1 space-y-2">
          <AlertTitle className={`${styles.title} font-bold mb-1`}>
            {title}
          </AlertTitle>
          <AlertDescription className={`${styles.description} leading-relaxed`}>
            {description}
          </AlertDescription>
          {action && (
            <div className="pt-2">
              {action.href ? (
                <Link href={action.href}>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`${styles.icon} border-current hover:bg-white/50`}
                  >
                    {action.label}
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={action.onClick}
                  className={`${styles.icon} border-current hover:bg-white/50`}
                >
                  {action.label}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Alert>
  );
}

// Specific error states for task claiming and submission

export function FullSlotErrorState() {
  return (
    <ErrorState
      variant="warning"
      title="Việc này đã hết chỗ"
      description="Tất cả các suất làm việc đã được giữ bởi những người làm khác. Hãy thử tìm các công việc tương tự hoặc quay lại sau khi có suất trống."
      action={{
        label: "Xem các việc khác",
        href: "/marketplace",
      }}
    />
  );
}

export function DuplicateClaimErrorState({ status }: { status?: string }) {
  const getMessageByStatus = () => {
    switch (status) {
      case "CLAIMED":
        return {
          title: "Bạn đã giữ chỗ việc này rồi",
          description:
            "Bạn đã có một suất làm việc đang hoạt động cho công việc này. Hãy hoàn thành và gửi bằng chứng trước khi giữ chỗ mới.",
        };
      case "SUBMITTED":
        return {
          title: "Bạn đã gửi bằng chứng rồi",
          description:
            "Bạn đã gửi bằng chứng cho công việc này và đang chờ người thuê duyệt. Vui lòng kiên nhẫn chờ đợi kết quả.",
        };
      case "CANCELLED":
      case "EXPIRED":
        return {
          title: "Không thể nhận lại việc này",
          description:
            "Bạn đã có lịch sử làm việc này trước đó và không thể nhận lại. Hãy tìm các công việc khác phù hợp.",
        };
      default:
        return {
          title: "Bạn đã nhận việc này rồi",
          description:
            "Bạn đã có một suất làm việc cho công việc này. Vui lòng kiểm tra trạng thái hiện tại trong trang 'Việc của tôi'.",
        };
    }
  };

  const message = getMessageByStatus();

  return (
    <ErrorState
      variant="info"
      title={message.title}
      description={message.description}
      action={{
        label: "Xem việc của tôi",
        href: "/dashboard/worker/tasks",
      }}
    />
  );
}

export function DuplicateSubmissionErrorState({ submissionStatus }: { submissionStatus?: string }) {
  const getMessageByStatus = () => {
    switch (submissionStatus) {
      case "PENDING":
        return {
          title: "Bạn đã gửi bằng chứng rồi",
          description:
            "Bằng chứng của bạn đang được xem xét bởi người thuê. Hệ thống sẽ tự động duyệt nếu không có phản hồi trong thời gian quy định. Vui lòng kiên nhẫn chờ đợi.",
          icon: <Clock className="size-5" />,
        };
      case "APPROVED":
        return {
          title: "Bằng chứng đã được duyệt",
          description:
            "Bằng chứng của bạn đã được chấp nhận và phần thưởng đã được thêm vào ví. Cảm ơn bạn đã hoàn thành công việc!",
          icon: <CheckCircle2 className="size-5" />,
          variant: "success" as ErrorStateVariant,
        };
      default:
        return {
          title: "Không thể gửi bằng chứng",
          description:
            "Bạn đã có bằng chứng đang được xử lý cho công việc này. Vui lòng chờ kết quả trước khi gửi lại.",
          icon: <AlertCircle className="size-5" />,
        };
    }
  };

  const message = getMessageByStatus();

  return (
    <ErrorState
      variant={message.variant || "info"}
      title={message.title}
      description={message.description}
      icon={message.icon}
      action={{
        label: "Xem việc của tôi",
        href: "/dashboard/worker/tasks",
      }}
    />
  );
}

export function TaskNotActiveErrorState({ taskStatus }: { taskStatus: string }) {
  const getMessageByStatus = () => {
    switch (taskStatus) {
      case "PAUSED":
        return {
          title: "Việc đang tạm dừng",
          description:
            "Người thuê đã tạm dừng công việc này. Hiện tại không thể giữ chỗ hoặc gửi bằng chứng. Hãy quay lại sau hoặc tìm công việc khác.",
        };
      case "COMPLETED":
        return {
          title: "Việc đã hoàn thành",
          description:
            "Công việc này đã được hoàn thành và đóng. Không còn nhận thêm người làm mới. Hãy tìm các công việc đang mở khác.",
        };
      case "CANCELLED":
        return {
          title: "Việc đã bị hủy",
          description:
            "Người thuê đã hủy công việc này. Không thể tiếp tục làm việc hoặc gửi bằng chứng. Hãy tìm công việc khác phù hợp.",
        };
      case "DRAFT":
        return {
          title: "Việc chưa được đăng",
          description:
            "Công việc này đang ở trạng thái nháp và chưa được công khai. Vui lòng chờ người thuê đăng công việc.",
        };
      default:
        return {
          title: "Việc không khả dụng",
          description:
            "Công việc này hiện không ở trạng thái cho phép nhận việc hoặc gửi bằng chứng. Vui lòng thử lại sau.",
        };
    }
  };

  const message = getMessageByStatus();

  return (
    <ErrorState
      variant="warning"
      title={message.title}
      description={message.description}
      action={{
        label: "Tìm việc khác",
        href: "/marketplace",
      }}
    />
  );
}

export function TaskExpiredErrorState() {
  return (
    <ErrorState
      variant="error"
      title="Việc đã hết hạn"
      description="Công việc này đã quá thời hạn nhận việc. Người thuê có thể đã đóng hoặc hủy công việc. Hãy tìm các công việc mới đang mở."
      action={{
        label: "Xem việc mới",
        href: "/marketplace",
      }}
    />
  );
}

export function NoClaimErrorState() {
  return (
    <ErrorState
      variant="info"
      title="Bạn chưa giữ chỗ việc này"
      description="Để gửi bằng chứng hoàn thành, bạn cần giữ chỗ công việc trước. Nhấn nút 'Giữ chỗ công việc' bên dưới để bắt đầu."
    />
  );
}

export function InvalidClaimStatusErrorState({ claimStatus }: { claimStatus: string }) {
  const getMessageByStatus = () => {
    switch (claimStatus) {
      case "CANCELLED":
        return {
          title: "Suất làm việc đã bị hủy",
          description:
            "Suất làm việc của bạn đã bị hủy. Bạn không thể gửi bằng chứng cho suất này nữa. Hãy kiểm tra lý do hủy hoặc liên hệ hỗ trợ nếu cần.",
        };
      case "EXPIRED":
        return {
          title: "Suất làm việc đã hết hạn",
          description:
            "Suất làm việc của bạn đã hết thời gian cho phép. Bạn không thể gửi bằng chứng muộn. Hãy tìm công việc khác để tiếp tục kiếm tiền.",
        };
      default:
        return {
          title: "Trạng thái không hợp lệ",
          description:
            "Suất làm việc của bạn không ở trạng thái cho phép gửi bằng chứng. Vui lòng kiểm tra lại hoặc liên hệ hỗ trợ.",
        };
    }
  };

  const message = getMessageByStatus();

  return (
    <ErrorState
      variant="error"
      title={message.title}
      description={message.description}
      action={{
        label: "Xem việc của tôi",
        href: "/dashboard/worker/tasks",
      }}
    />
  );
}
