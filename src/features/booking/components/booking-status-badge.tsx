import { BOOKING_STATUS_LABELS, type BookingStatusValue } from "@/features/booking/labels";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const VARIANT: Record<BookingStatusValue, BadgeProps["variant"]> = {
  no_booking: "alert",
  with_booking: "ok",
  shipped: "default",
};

export function BookingStatusBadge({ status }: { status: string }) {
  const key = status as BookingStatusValue;
  return (
    <Badge variant={VARIANT[key] ?? "muted"}>
      {BOOKING_STATUS_LABELS[key] ?? status}
    </Badge>
  );
}
