import { ORDER_STATUS_LABELS } from "@/lib/rbac";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { OrderStatusValue } from "@/features/orders/status";

const STATUS_VARIANT: Record<OrderStatusValue, BadgeProps["variant"]> = {
  created: "muted",
  booking_pending: "warn",
  booked: "default",
  shipped: "secondary",
  customs_in_process: "warn",
  customs_cleared: "ok",
  costed: "ok",
  closed: "muted",
};

export function OrderStatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT[status as OrderStatusValue] ?? "muted";
  return <Badge variant={variant}>{ORDER_STATUS_LABELS[status] ?? status}</Badge>;
}
