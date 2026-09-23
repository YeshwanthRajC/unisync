import { Badge } from "@/components/ui/badge";
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from "@/services/appointments";

const VARIANT: Record<AppointmentStatus, React.ComponentProps<typeof Badge>["variant"]> = {
  SCHEDULED: "outline",
  CONFIRMED: "secondary",
  IN_PROGRESS: "default",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
  NO_SHOW: "destructive",
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge variant={VARIANT[status]}>{APPOINTMENT_STATUS_LABELS[status]}</Badge>;
}
