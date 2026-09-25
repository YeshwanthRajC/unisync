import { Badge } from "@/components/ui/badge";
import {
  BILL_STATUS_LABELS,
  type BillStatus,
} from "@/services/billing/schema";

const BILL_STATUS_VARIANTS: Record<
  BillStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  DRAFT: "secondary",
  ISSUED: "default",
  VOID: "destructive",
};

export function BillStatusBadge({ status }: { status: BillStatus }) {
  return (
    <Badge variant={BILL_STATUS_VARIANTS[status]}>
      {BILL_STATUS_LABELS[status]}
    </Badge>
  );
}
