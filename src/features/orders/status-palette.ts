import { OrderStatus } from "@prisma/client";

/** AURA status palette — navy/teal scale (executive, low chroma) */
export type StatusSwatch = {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  className: string;
};

export const ORDER_STATUS_PALETTE: Record<OrderStatus, StatusSwatch> = {
  [OrderStatus.created]: {
    backgroundColor: "#94A3B8",
    borderColor: "#64748B",
    textColor: "#FFFFFF",
    className: "fc-event-status-created",
  },
  [OrderStatus.booking_pending]: {
    backgroundColor: "#64748B",
    borderColor: "#475569",
    textColor: "#FFFFFF",
    className: "fc-event-status-booking_pending",
  },
  [OrderStatus.booked]: {
    backgroundColor: "#3D5A80",
    borderColor: "#2E4666",
    textColor: "#FFFFFF",
    className: "fc-event-status-booked",
  },
  [OrderStatus.shipped]: {
    backgroundColor: "#1E3A5F",
    borderColor: "#162C48",
    textColor: "#FFFFFF",
    className: "fc-event-status-shipped",
  },
  [OrderStatus.customs_in_process]: {
    backgroundColor: "#0F2744",
    borderColor: "#0A1C30",
    textColor: "#FFFFFF",
    className: "fc-event-status-customs_in_process",
  },
  [OrderStatus.customs_cleared]: {
    backgroundColor: "#2F6F6A",
    borderColor: "#245E5A",
    textColor: "#FFFFFF",
    className: "fc-event-status-customs_cleared",
  },
  [OrderStatus.costed]: {
    backgroundColor: "#245E5A",
    borderColor: "#1B4A47",
    textColor: "#FFFFFF",
    className: "fc-event-status-costed",
  },
  [OrderStatus.closed]: {
    backgroundColor: "#475569",
    borderColor: "#334155",
    textColor: "#FFFFFF",
    className: "fc-event-status-closed",
  },
};

export const ALL_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.created,
  OrderStatus.booking_pending,
  OrderStatus.booked,
  OrderStatus.shipped,
  OrderStatus.customs_in_process,
  OrderStatus.customs_cleared,
  OrderStatus.costed,
  OrderStatus.closed,
];

/** Default dashboard filter: hide costed + closed (active pipeline only) */
export const DEFAULT_DASHBOARD_STATUSES: OrderStatus[] = ALL_ORDER_STATUSES.filter(
  (s) => s !== OrderStatus.costed && s !== OrderStatus.closed,
);

export function isLightStatusText(textColor: string): boolean {
  return textColor.toUpperCase() === "#0A0A0A" || textColor.toUpperCase() === "#000000";
}
