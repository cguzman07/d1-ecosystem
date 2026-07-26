import { OrderStatus } from "@prisma/client";

/** D1 status palette — 8 distinct colors for calendar / Gantt / legend */
export type StatusSwatch = {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  className: string;
};

export const ORDER_STATUS_PALETTE: Record<OrderStatus, StatusSwatch> = {
  [OrderStatus.created]: {
    backgroundColor: "#E30613",
    borderColor: "#C10510",
    textColor: "#FFFFFF",
    className: "fc-event-status-created",
  },
  [OrderStatus.booking_pending]: {
    backgroundColor: "#EA580C",
    borderColor: "#C2410C",
    textColor: "#FFFFFF",
    className: "fc-event-status-booking_pending",
  },
  [OrderStatus.booked]: {
    backgroundColor: "#FFF200",
    borderColor: "#E6DB00",
    textColor: "#0A0A0A",
    className: "fc-event-status-booked",
  },
  [OrderStatus.shipped]: {
    backgroundColor: "#2563EB",
    borderColor: "#1D4ED8",
    textColor: "#FFFFFF",
    className: "fc-event-status-shipped",
  },
  [OrderStatus.customs_in_process]: {
    backgroundColor: "#7C3AED",
    borderColor: "#6D28D9",
    textColor: "#FFFFFF",
    className: "fc-event-status-customs_in_process",
  },
  [OrderStatus.customs_cleared]: {
    backgroundColor: "#16A34A",
    borderColor: "#15803D",
    textColor: "#FFFFFF",
    className: "fc-event-status-customs_cleared",
  },
  [OrderStatus.costed]: {
    backgroundColor: "#0D9488",
    borderColor: "#0F766E",
    textColor: "#FFFFFF",
    className: "fc-event-status-costed",
  },
  [OrderStatus.closed]: {
    backgroundColor: "#4B5563",
    borderColor: "#374151",
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
