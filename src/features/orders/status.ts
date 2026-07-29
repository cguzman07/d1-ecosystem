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

/**
 * "Next action" label for the board view — tells you whose turn it is,
 * derived purely from order status (no extra queries). This is what
 * turns the board into a real flight-status summary instead of just
 * a status badge.
 */
export function getNextActionLabel(status: OrderStatusValue): string {
  switch (status) {
    case "created":
      return "Especialista: asignar agente y aduana";
    case "booking_pending":
      return "Proveedor: cargar documentos de embarque";
    case "booked":
      return "Agente de carga: confirmar zarpe";
    case "shipped":
      return "Aduana: iniciar trámite de importación";
    case "customs_in_process":
      return "Aduana: gestionar levante";
    case "customs_cleared":
      return "Especialista: finalizar costeo";
    case "costed":
      return "Especialista: cerrar orden";
    case "closed":
      return "Completado";
    default:
      return "—";
  }
}
