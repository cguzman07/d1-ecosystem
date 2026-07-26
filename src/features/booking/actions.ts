"use server";

import { BookingStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRoles } from "@/lib/session";
import { createOrUpdateBooking } from "@/features/booking/service";

export type BookingActionResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

const BOOKING_ROLES: Role[] = [
  Role.admin,
  Role.internal_specialist,
  Role.freight_forwarder,
];

function mapError(error: unknown): string {
  if (!(error instanceof Error)) return "Error inesperado";
  switch (error.message) {
    case "UNAUTHORIZED":
      return "Debes iniciar sesión";
    case "FORBIDDEN":
      return "No tienes permiso para esta acción";
    case "ORDER_NOT_FOUND":
      return "Orden no encontrada";
    case "FORWARDER_NOT_ASSIGNED":
      return "Solo el agente de carga asignado puede editar este booking";
    default:
      return error.message || "Error inesperado";
  }
}

function revalidateBookingPaths(orderId: string) {
  revalidatePath("/");
  revalidatePath("/tablero");
  revalidatePath("/booking");
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}/booking`);
  revalidatePath("/notificaciones");
}

export async function createOrUpdateBookingAction(
  formData: FormData,
): Promise<BookingActionResult> {
  try {
    const session = await requireRoles(BOOKING_ROLES);

    const orderId = String(formData.get("orderId") ?? "").trim();
    if (!orderId) {
      return { ok: false, error: "Orden no indicada" };
    }

    if (session.user.role === Role.freight_forwarder) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { freightForwarderId: true },
      });
      if (!order || order.freightForwarderId !== session.user.id) {
        return { ok: false, error: mapError(new Error("FORWARDER_NOT_ASSIGNED")) };
      }
    }

    const statusRaw = String(formData.get("status") ?? "").trim();
    if (!Object.values(BookingStatus).includes(statusRaw as BookingStatus)) {
      return { ok: false, error: "Estado de booking no válido" };
    }

    const containersRaw = String(formData.get("containerNumbers") ?? "");
    const containerNumbers = containersRaw
      .split(/[\n,;]+/)
      .map((c) => c.trim())
      .filter(Boolean);

    await createOrUpdateBooking({
      orderId,
      changedById: session.user.id,
      departureDate: String(formData.get("departureDate") ?? "") || null,
      arrivalDate: String(formData.get("arrivalDate") ?? "") || null,
      containerNumbers,
      carrier: String(formData.get("carrier") ?? "") || null,
      status: statusRaw as BookingStatus,
    });

    revalidateBookingPaths(orderId);
    return { ok: true, orderId };
  } catch (error) {
    return { ok: false, error: mapError(error) };
  }
}
