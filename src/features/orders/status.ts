/** Client-safe status helpers (no Prisma runtime imports). */

import { differenceInMilliseconds } from "date-fns";

export const ORDER_STATUS_VALUES = [
  "created",
  "booking_pending",
  "booked",
  "shipped",
  "customs_in_process",
  "customs_cleared",
  "costed",
  "closed",
] as const;

export type OrderStatusValue = (typeof ORDER_STATUS_VALUES)[number];

/**
 * Alert when order is still created/booking_pending for more than N days
 * without activity (defaults to 3).
 */
export function isStaleEarlyStage(
  order: {
    status: string;
    createdAt: Date;
    lastActivityAt: Date;
  },
  days = 3,
): boolean {
  if (order.status !== "created" && order.status !== "booking_pending") {
    return false;
  }
  const anchor = order.lastActivityAt ?? order.createdAt;
  const thresholdMs = days * 24 * 60 * 60 * 1000;
  return differenceInMilliseconds(new Date(), new Date(anchor)) > thresholdMs;
}
