import { Badge } from "@/components/ui/badge";
import {
  FOLLOWUP_STATUS_LABELS,
  type FollowUpStatus,
} from "@/services/followups/schema";

const STATUS_VARIANTS: Record<
  FollowUpStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  PENDING: "outline",
  DUE: "default",
  OVERDUE: "destructive",
  COMPLETED: "secondary",
  CANCELLED: "outline",
};

export function FollowUpStatusBadge({ status }: { status: FollowUpStatus }) {
  const isCompleted = status === "COMPLETED";

  return (
    <Badge
      variant={STATUS_VARIANTS[status]}
      className={
        isCompleted
          ? "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
          : undefined
      }
    >
      {FOLLOWUP_STATUS_LABELS[status]}
    </Badge>
  );
}
