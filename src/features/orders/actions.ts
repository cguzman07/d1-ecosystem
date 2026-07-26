"use server";

import { OrderStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireRoles } from "@/lib/session";
import {
  createOrder,
  updateOrderStatus,
} from "@/features/orders/service";

export type ActionResult =
  | { ok: true; orderId: string; orderNumber?: string }
  | { ok: false; error: string };

const ORDER_MANAGERS: Role[] = [Role.admin, Role.internal_specialist];

function mapError(error: unknown): string {
  if (!(error instanceof Error)) return "Error inesperado";
  switch (error.message) {
    case "UNAUTHORIZED":
      return "Debes iniciar sesión";
    case "FORBIDDEN":
      return "No tienes permiso para esta acción";
    case "SUPPLIER_NOT_FOUND":
      return "Proveedor no encontrado o inactivo";
    case "FORWARDER_NOT_FOUND":
      return "Agente de carga no válido";
    case "CUSTOMS_AGENCY_NOT_FOUND":
      return "Agencia de aduana no válida";
    case "ORDER_NOT_FOUND":
      return "Orden no encontrada";
    default:
      return error.message || "Error inesperado";
  }
}

function revalidateOrderPaths(orderId?: string) {
  revalidatePath("/");
  revalidatePath("/tablero");
  revalidatePath("/orders");
  if (orderId) {
    revalidatePath(`/orders/${orderId}`);
  }
}

export async function createOrderAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireRoles(ORDER_MANAGERS);

    const supplierId = String(formData.get("supplierId") ?? "").trim();
    if (!supplierId) {
      return { ok: false, error: "El proveedor es obligatorio" };
    }

    const sapReference = String(formData.get("sapReference") ?? "").trim() || null;
    const freightForwarderId =
      String(formData.get("freightForwarderId") ?? "").trim() || null;
    const customsAgencyId =
      String(formData.get("customsAgencyId") ?? "").trim() || null;
    const notes = String(formData.get("notes") ?? "").trim() || null;

    const order = await createOrder({
      supplierId,
      sapReference,
      freightForwarderId,
      customsAgencyId,
      notes,
      createdById: session.user.id,
    });

    revalidateOrderPaths(order.id);
    return { ok: true, orderId: order.id, orderNumber: order.orderNumber };
  } catch (error) {
    return { ok: false, error: mapError(error) };
  }
}

export async function updateOrderStatusAction(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireRoles(ORDER_MANAGERS);

    const orderId = String(formData.get("orderId") ?? "").trim();
    const newStatus = String(formData.get("newStatus") ?? "").trim() as OrderStatus;
    const note = String(formData.get("note") ?? "").trim() || null;

    if (!orderId) {
      return { ok: false, error: "Orden no indicada" };
    }

    if (!Object.values(OrderStatus).includes(newStatus)) {
      return { ok: false, error: "Estado no válido" };
    }

    const order = await updateOrderStatus({
      orderId,
      newStatus,
      changedById: session.user.id,
      note,
    });

    revalidateOrderPaths(order.id);
    return { ok: true, orderId: order.id, orderNumber: order.orderNumber };
  } catch (error) {
    return { ok: false, error: mapError(error) };
  }
}
