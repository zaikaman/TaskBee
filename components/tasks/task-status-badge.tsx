import { Badge } from "@/components/ui/badge";
import { TaskStatus } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";
import {
  FileEdit,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface TaskStatusBadgeProps {
  status: TaskStatus;
  className?: string;
  showIcon?: boolean;
}

const statusConfig: Record<
  TaskStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ElementType;
    colorClass?: string;
  }
> = {
  DRAFT: {
    label: "Nháp",
    variant: "secondary",
    icon: FileEdit,
  },
  ACTIVE: {
    label: "Đang hoạt động",
    variant: "default",
    icon: PlayCircle,
    colorClass: "bg-green-500 hover:bg-green-600 text-white",
  },
  PAUSED: {
    label: "Tạm dừng",
    variant: "secondary",
    icon: PauseCircle,
    colorClass: "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
  },
  COMPLETED: {
    label: "Hoàn thành",
    variant: "default",
    icon: CheckCircle2,
    colorClass: "bg-blue-500 hover:bg-blue-600 text-white",
  },
  CANCELLED: {
    label: "Đã huỷ",
    variant: "destructive",
    icon: XCircle,
  },
};

export function TaskStatusBadge({
  status,
  className,
  showIcon = true,
}: TaskStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(config.colorClass, className)}
    >
      {showIcon && <Icon className="mr-1 h-3 w-3" />}
      {config.label}
    </Badge>
  );
}
