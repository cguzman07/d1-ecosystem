"use server";

import { InspectionStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRoles } from "@/lib/session";
import { createOrUpdateCustomsRecord } from "@/features/customs/service";

export type CustomsActionResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

const CUSTOMS_ROLES: Role[] = [
  Role.admin,
  Role.internal_specialist,
  Role.customs_agency,
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
    case "CUSTOMS_AGENCY_REQUIRED":
      return "La orden no tiene agencia de aduana asignada";
    case "AGENCY_NOT_ASSIGNED":
      return "Solo la agencia asignada puede editar este expediente";
    default:
      return error.message || "Error inesperado";
  }
}

function revalidateCustomsPaths(orderId: string) {
  revalidatePath("/");
  revalidatePath("/tablero");
  revalidatePath("/customs");
  revalidatePath("/aduana");
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}/customs`);
  revalidatePath("/notificaciones");
}

export async function createOrUpdateCustomsAction(
  formData: FormData,
): Promise<CustomsActionResult> {
  try {
    const session = await requireRoles(CUSTOMS_ROLES);

    const orderId = String(formData.get("orderId") ?? "").trim();
    if (!orderId) return { ok: false, error: "Orden no indicada" };

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { customsAgencyId: true },
    });
    if (!order) return { ok: false, error: "Orden no encontrada" };

    if (session.user.role === Role.customs_agency) {
      if (order.customsAgencyId !== session.user.id) {
        return { ok: false, error: mapError(new Error("AGENCY_NOT_ASSIGNED")) };
      }
    }

    const inspectionRaw = String(formData.get("inspectionStatus") ?? "").trim();
    if (
      inspectionRaw &&
      !Object.values(InspectionStatus).includes(inspectionRaw as InspectionStatus)
    ) {
      return { ok: false, error: "Estado de inspección no válido" };
    }

    const agencyId =
      session.user.role === Role.customs_agency
        ? session.user.id
        : order.customsAgencyId;

    await createOrUpdateCustomsRecord({
      orderId,
      changedById: session.user.id,
      customsAgencyId: agencyId,
      declarationNumber: String(formData.get("declarationNumber") ?? "") || null,
      presentationDate: String(formData.get("presentationDate") ?? "") || null,
      levanteDate: String(formData.get("levanteDate") ?? "") || null,
      inspectionStatus: (inspectionRaw as InspectionStatus) || undefined,
      inspectionCompletionDate:
        String(formData.get("inspectionCompletionDate") ?? "") || null,
      notes: String(formData.get("notes") ?? "") || null,
    });

    revalidateCustomsPaths(orderId);
    return { ok: true, orderId };
  } catch (error) {
    return { ok: false, error: mapError(error) };
  }
}
