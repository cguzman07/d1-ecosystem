"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireRoles } from "@/lib/session";
import { prisma } from "@/lib/db";
import {
  createOrUpdateCostingRecord,
  finalizeCosting,
  type CostingLineInput,
} from "@/features/costing/service";

export type CostingActionResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

const COSTING_ROLES: Role[] = [Role.admin, Role.internal_specialist];

function mapError(error: unknown): string {
  if (!(error instanceof Error)) return "Error inesperado";
  switch (error.message) {
    case "UNAUTHORIZED":
      return "Debes iniciar sesión";
    case "FORBIDDEN":
      return "No tienes permiso para esta acción";
    case "ORDER_NOT_FOUND":
      return "Orden no encontrada";
    case "COSTING_NOT_FOUND":
      return "No hay registro de costeo para esta orden";
    case "COSTING_CLOSED":
    case "COSTING_ALREADY_FINALIZED":
      return "El costeo ya fue finalizado y no se puede editar";
    case "ORDER_NOT_READY_FOR_COSTING":
      return "La orden debe estar en levante para costear";
    case "COSTING_LINE_ITEMS_REQUIRED":
      return "Debes agregar al menos una línea de costo";
    default:
      return error.message || "Error inesperado";
  }
}

function revalidateCostingPaths(orderId: string) {
  revalidatePath("/");
  revalidatePath("/tablero");
  revalidatePath("/costing");
  revalidatePath("/costeo");
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}/costing`);
  revalidatePath("/notificaciones");
}

function parseLineItemsFromForm(formData: FormData): CostingLineInput[] {
  const raw = String(formData.get("lineItemsJson") ?? "[]");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("LINE_ITEMS_INVALID");
  }
  if (!Array.isArray(parsed)) throw new Error("LINE_ITEMS_INVALID");

  return parsed.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      id: typeof row.id === "string" ? row.id : undefined,
      category: String(row.category ?? "other"),
      description: String(row.description ?? ""),
      amount: String(row.amount ?? "0"),
      currency: String(row.currency ?? "USD"),
    };
  });
}

export async function saveCostingAction(
  formData: FormData,
): Promise<CostingActionResult> {
  try {
    const session = await requireRoles(COSTING_ROLES);
    const orderId = String(formData.get("orderId") ?? "").trim();
    if (!orderId) return { ok: false, error: "Orden no indicada" };

    let lineItems: CostingLineInput[];
    try {
      lineItems = parseLineItemsFromForm(formData);
    } catch {
      return { ok: false, error: "Formato de líneas de costo inválido" };
    }

    await createOrUpdateCostingRecord({
      orderId,
      changedById: session.user.id,
      notes: String(formData.get("notes") ?? "") || null,
      currency: String(formData.get("currency") ?? "USD") || "USD",
      lineItems,
    });

    revalidateCostingPaths(orderId);
    return { ok: true, orderId };
  } catch (error) {
    return { ok: false, error: mapError(error) };
  }
}

export async function finalizeCostingAction(
  formData: FormData,
): Promise<CostingActionResult> {
  try {
    const session = await requireRoles(COSTING_ROLES);
    const orderId = String(formData.get("orderId") ?? "").trim();
    if (!orderId) return { ok: false, error: "Orden no indicada" };

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (!order) return { ok: false, error: "Orden no encontrada" };

    const { assertCostingCanFinalize } = await import("@/features/orders/workflow");
    assertCostingCanFinalize({ status: order.status });

    // Persist latest lines before finalize if provided
    const raw = formData.get("lineItemsJson");
    if (raw) {
      let lineItems: CostingLineInput[];
      try {
        lineItems = parseLineItemsFromForm(formData);
      } catch {
        return { ok: false, error: "Formato de líneas de costo inválido" };
      }
      await createOrUpdateCostingRecord({
        orderId,
        changedById: session.user.id,
        notes: String(formData.get("notes") ?? "") || null,
        currency: String(formData.get("currency") ?? "USD") || "USD",
        lineItems,
      });
    }

    await finalizeCosting({
      orderId,
      calculatedById: session.user.id,
    });

    revalidateCostingPaths(orderId);
    return { ok: true, orderId };
  } catch (error) {
    return { ok: false, error: mapError(error) };
  }
}
