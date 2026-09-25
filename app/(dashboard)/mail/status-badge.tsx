import { Badge } from "@/components/ui/badge";
import {
  PATIENT_EMAIL_STATUS_LABELS,
  type PatientEmailStatus,
} from "@/services/mail/schema";

const STATUS_VARIANTS: Record<
  PatientEmailStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  DRAFT: "secondary",
  QUEUED: "outline",
  SENT: "default",
  FAILED: "destructive",
  PROVIDER_NOT_CONFIGURED: "outline",
};

export function PatientEmailStatusBadge({ status }: { status: PatientEmailStatus }) {
  const isPreview = status === "PROVIDER_NOT_CONFIGURED";

  return (
    <Badge
      variant={STATUS_VARIANTS[status]}
      className={
        isPreview
          ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
          : undefined
      }
    >
      {PATIENT_EMAIL_STATUS_LABELS[status]}
    </Badge>
  );
}
