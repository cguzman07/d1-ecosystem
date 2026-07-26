import { BookingStatus, DocumentChecklistStatus, OrderStatus } from "@prisma/client";
import type { CalendarOrderRow } from "@/features/orders/service";
import { ORDER_STATUS_PALETTE } from "@/features/orders/status-palette";

export type CalendarMilestone = "ZARPE" | "ARRIBO" | "LEVANTE" | "CREADA";

export type CalendarDocItem = {
  id: string;
  documentType: string;
  status: DocumentChecklistStatus;
};

/** Serializable case payload for the calendar client + modal */
export type CalendarCaseEvent = {
  id: string;
  title: string;
  start: string;
  /** Always omitted — milestones are single-day blocks */
  end?: undefined;
  allDay: boolean;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  className: string;
  extendedProps: {
    orderId: string;
    orderNumber: string;
    supplierName: string;
    status: OrderStatus;
    milestone: CalendarMilestone;
    bookingDone: boolean;
    shipmentDocsApproved: boolean;
    customsCleared: boolean;
    costingFinalized: boolean;
    /** 0–100 progress across the four case pillars */
    progressPct: number;
    documents: CalendarDocItem[];
    freightForwarderName: string | null;
    customsAgencyName: string | null;
    carrier: string | null;
    containers: string[];
    departureDate: string | null;
    arrivalDate: string | null;
    levanteDate: string | null;
  };
};

/** One row for the dashboard multi-order Gantt */
export type BoardGanttRow = {
  orderId: string;
  orderNumber: string;
  supplierName: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  departureDate: string | null;
  arrivalDate: string | null;
  presentationDate: string | null;
  levanteDate: string | null;
  costingCalculatedAt: string | null;
  costingClosed: boolean;
};

export const MILESTONE_SHORT: Record<CalendarMilestone, string> = {
  CREADA: "Creada",
  ZARPE: "Zarpe",
  ARRIBO: "Arribo",
  LEVANTE: "Levante",
};

function toDateOnlyIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function agentLabel(
  user: { name: string; companyName: string | null } | null | undefined,
): string | null {
  if (!user) return null;
  return user.companyName?.trim() || user.name;
}

function buildCaseProps(order: CalendarOrderRow) {
  const departure = order.booking?.departureDate ?? null;
  const arrival = order.booking?.arrivalDate ?? null;
  const levante = order.customs?.releaseDate ?? null;

  const docs = order.shipment?.requiredDocuments ?? [];
  const shipmentDocsApproved =
    docs.length > 0 &&
    docs.every((d) => d.status === DocumentChecklistStatus.approved);

  const advancedStatuses: OrderStatus[] = [
    OrderStatus.booked,
    OrderStatus.shipped,
    OrderStatus.customs_in_process,
    OrderStatus.customs_cleared,
    OrderStatus.costed,
    OrderStatus.closed,
  ];

  const bookingDone = Boolean(
    order.booking &&
      (order.booking.status === BookingStatus.with_booking ||
        order.booking.status === BookingStatus.shipped ||
        advancedStatuses.includes(order.status)),
  );

  const clearedStatuses: OrderStatus[] = [
    OrderStatus.customs_cleared,
    OrderStatus.costed,
    OrderStatus.closed,
  ];

  const customsCleared = Boolean(levante || clearedStatuses.includes(order.status));
  const costingFinalized = Boolean(order.costing?.closed);

  const pillars = [bookingDone, shipmentDocsApproved, customsCleared, costingFinalized];
  const progressPct = Math.round((pillars.filter(Boolean).length / pillars.length) * 100);

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    supplierName: order.supplier.name,
    status: order.status,
    bookingDone,
    shipmentDocsApproved,
    customsCleared,
    costingFinalized,
    progressPct,
    documents: docs.map((d) => ({
      id: d.id,
      documentType: d.documentType,
      status: d.status,
    })),
    freightForwarderName: agentLabel(order.freightForwarder),
    customsAgencyName: agentLabel(order.customsAgency),
    carrier: order.booking?.carrier ?? null,
    containers: order.booking?.containerNumbers ?? [],
    departureDate: departure ? toDateOnlyIso(departure) : null,
    arrivalDate: arrival ? toDateOnlyIso(arrival) : null,
    levanteDate: levante ? toDateOnlyIso(levante) : null,
  };
}

function makeMilestoneEvent(
  order: CalendarOrderRow,
  milestone: CalendarMilestone,
  date: Date,
  baseProps: ReturnType<typeof buildCaseProps>,
): CalendarCaseEvent {
  // Color by order status (8-tone legend), not by milestone type
  const colors =
    ORDER_STATUS_PALETTE[order.status] ?? ORDER_STATUS_PALETTE[OrderStatus.created];

  return {
    id: `${order.id}-${milestone}`,
    title: `${order.orderNumber} · ${MILESTONE_SHORT[milestone]}`,
    start: toDateOnlyIso(date),
    end: undefined,
    allDay: true,
    backgroundColor: colors.backgroundColor,
    borderColor: colors.borderColor,
    textColor: colors.textColor,
    className: colors.className,
    extendedProps: {
      ...baseProps,
      milestone,
    },
  };
}

/**
 * Map orders → single-day milestone events (no multi-day bars).
 * Sensitive dates only: zarpe, arribo, levante (+ creada if still early).
 */
export function mapOrdersToCalendarEvents(
  orders: CalendarOrderRow[],
): CalendarCaseEvent[] {
  const events: CalendarCaseEvent[] = [];

  for (const order of orders) {
    const baseProps = buildCaseProps(order);
    const departure = order.booking?.departureDate ?? null;
    const arrival = order.booking?.arrivalDate ?? null;
    const levante = order.customs?.releaseDate ?? null;
    const hasBookingDates = Boolean(departure || arrival);

    if (departure) {
      events.push(makeMilestoneEvent(order, "ZARPE", departure, baseProps));
    }
    if (arrival) {
      events.push(makeMilestoneEvent(order, "ARRIBO", arrival, baseProps));
    }
    if (levante) {
      events.push(makeMilestoneEvent(order, "LEVANTE", levante, baseProps));
    }
    if (!hasBookingDates) {
      events.push(makeMilestoneEvent(order, "CREADA", order.createdAt, baseProps));
    }
  }

  return events;
}

/** Serializable rows for the dashboard multi-order Gantt */
export function mapOrdersToBoardGanttRows(
  orders: CalendarOrderRow[],
): BoardGanttRow[] {
  return orders.map((order) => ({
    orderId: order.id,
    orderNumber: order.orderNumber,
    supplierName: order.supplier.name,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    departureDate: order.booking?.departureDate?.toISOString() ?? null,
    arrivalDate: order.booking?.arrivalDate?.toISOString() ?? null,
    presentationDate: order.customs?.presentationDate?.toISOString() ?? null,
    levanteDate: order.customs?.releaseDate?.toISOString() ?? null,
    costingCalculatedAt: order.costing?.calculatedAt?.toISOString() ?? null,
    costingClosed: order.costing?.closed ?? false,
  }));
}
