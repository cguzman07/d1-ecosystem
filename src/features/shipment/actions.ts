"use server";

import { DocumentChecklistStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireRoles, requireSession } from "@/lib/session";
import {
  ensureShipmentForOrder,
  updateRequiredDocumentStatus,
} from "@/features/shipment/service";
import { getSupplierIdForUser } from "@/features/orders/service";
import { prisma } from "@/lib/db";

export type ShipmentActionResult =
  | { ok: true }
  | { ok: false; error: string };

function mapError(error: unknown): string {
  if (!(error instanceof Error)) return "Error inesperado";
  switch (error.message) {
    case "UNAUTHORIZED":
      return "Debes iniciar sesión";
    case "FORBIDDEN":
      return "No tienes permiso para esta acción";
    case "ORDER_NOT_FOUND":
      return "Orden no encontrada";
    case "REQUIRED_DOCUMENT_NOT_FOUND":
      return "Documento requerido no encontrado";
    case "CORRECTION_REASON_REQUIRED":
      return "Debes indicar el motivo de la corrección";
    default:
      return error.message || "Error inesperado";
  }
}

function revalidateShipmentPaths(orderId: string) {
  revalidatePath("/");
  revalidatePath("/tablero");
  revalidatePath("/shipment");
  revalidatePath("/embarque");
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}/shipment`);
  revalidatePath(`/orders/${orderId}/documents`);
  revalidatePath("/notificaciones");
}

async function assertShipmentAccess(orderId: string, userId: string, role: Role) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { supplier: true },
  });
  if (!order) throw new Error("ORDER_NOT_FOUND");

  if (role === Role.admin || role === Role.internal_specialist) return order;
  if (role === Role.supplier) {
    const supplierId = await getSupplierIdForUser(userId);
    if (!supplierId || order.supplierId !== supplierId) throw new Error("FORBIDDEN");
    return order;
  }
  throw new Error("FORBIDDEN");
}

export async function initializeShipmentAction(
  orderId: string,
): Promise<ShipmentActionResult> {
  try {
    const session = await requireRoles([
      Role.admin,
      Role.internal_specialist,
      Role.supplier,
    ]);
    await assertShipmentAccess(orderId, session.user.id, session.user.role as Role);
    await ensureShipmentForOrder(orderId);
    revalidateShipmentPaths(orderId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mapError(error) };
  }
}

export async function updateRequiredDocumentStatusAction(
  formData: FormData,
): Promise<ShipmentActionResult> {
  try {
    const session = await requireRoles([Role.admin, Role.internal_specialist]);

    const requiredDocumentId = String(formData.get("requiredDocumentId") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim() as DocumentChecklistStatus;
    const correctionReason =
      String(formData.get("correctionReason") ?? "").trim() || null;

    if (!requiredDocumentId) {
      return { ok: false, error: "Documento requerido no indicado" };
    }
    if (!Object.values(DocumentChecklistStatus).includes(status)) {
      return { ok: false, error: "Estado no válido" };
    }

    const required = await prisma.shipmentRequiredDocument.findUnique({
      where: { id: requiredDocumentId },
      include: { shipment: true },
    });
    if (!required) return { ok: false, error: "Documento requerido no encontrado" };

    await updateRequiredDocumentStatus({
      requiredDocumentId,
      status,
      updatedById: session.user.id,
      correctionReason,
    });

    revalidateShipmentPaths(required.shipment.orderId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mapError(error) };
  }
}

/** Soft session check used by shared pages */
export async function getShipmentSession() {
  return requireSession();
}
