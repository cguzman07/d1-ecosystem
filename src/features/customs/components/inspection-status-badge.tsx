import {
  INSPECTION_STATUS_LABELS,
  type InspectionStatusValue,
} from "@/features/customs/labels";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const VARIANT: Record<InspectionStatusValue, BadgeProps["variant"]> = {
  not_required: "muted",
  pending: "warn",
  in_process: "default",
  completed: "ok",
};

export function InspectionStatusBadge({ status }: { status: string }) {
  const key = status as InspectionStatusValue;
  return (
    <Badge variant={VARIANT[key] ?? "muted"}>
      {INSPECTION_STATUS_LABELS[key] ?? status}
    </Badge>
  );
}
