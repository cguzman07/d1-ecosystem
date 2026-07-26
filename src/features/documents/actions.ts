"use server";

import { DocumentCategory, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireRoles } from "@/lib/session";
import { prisma } from "@/lib/db";
import {
  assertOrderDocumentAccess,
  getDocumentDownloadUrl,
  uploadDocument,
} from "@/features/documents/service";

export type DocumentActionResult =
  | { ok: true; documentId?: string; url?: string; fileName?: string }
  | { ok: false; error: string };

const UPLOAD_ROLES: Role[] = [
  Role.admin,
  Role.internal_specialist,
  Role.supplier,
];

const VIEW_ROLES: Role[] = [
  Role.admin,
  Role.internal_specialist,
  Role.supplier,
  Role.freight_forwarder,
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
    case "DOCUMENT_NOT_FOUND":
      return "Documento no encontrado";
    case "REQUIRED_DOCUMENT_NOT_FOUND":
      return "Requisito de documento no encontrado";
    case "FILE_REQUIRED":
      return "Debes seleccionar un archivo";
    case "FILE_TOO_LARGE":
      return "El archivo supera el límite de 10 MB";
    default:
      return error.message || "Error inesperado";
  }
}

function revalidateDocPaths(orderId: string) {
  revalidatePath("/");
  revalidatePath("/tablero");
  revalidatePath("/shipment");
  revalidatePath("/documentacion");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}/shipment`);
  revalidatePath(`/orders/${orderId}/documents`);
  revalidatePath("/notificaciones");
}

export async function uploadDocumentAction(
  formData: FormData,
): Promise<DocumentActionResult> {
  try {
    const session = await requireRoles(UPLOAD_ROLES);

    const orderId = String(formData.get("orderId") ?? "").trim();
    if (!orderId) return { ok: false, error: "Orden no indicada" };

    await assertOrderDocumentAccess({
      orderId,
      role: session.user.role as Role,
      userId: session.user.id,
    });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        shipment: { include: { requiredDocuments: { select: { status: true } } } },
      },
    });
    if (!order) return { ok: false, error: "Orden no encontrada" };

    const { assertSupplierCanUploadDocuments, docsApprovedFromShipment } =
      await import("@/features/orders/workflow");
    if (session.user.role === Role.supplier) {
      assertSupplierCanUploadDocuments({
        status: order.status,
        shipmentDocsApproved: docsApprovedFromShipment(order.shipment),
      });
    }

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: mapError(new Error("FILE_REQUIRED")) };
    }
    if (file.size > 10 * 1024 * 1024) {
      return { ok: false, error: mapError(new Error("FILE_TOO_LARGE")) };
    }

    const requiredDocumentId =
      String(formData.get("requiredDocumentId") ?? "").trim() || null;
    const categoryRaw = String(formData.get("category") ?? "general").trim();
    const category = Object.values(DocumentCategory).includes(
      categoryRaw as DocumentCategory,
    )
      ? (categoryRaw as DocumentCategory)
      : DocumentCategory.general;

    const buffer = Buffer.from(await file.arrayBuffer());

    const document = await uploadDocument({
      orderId,
      uploadedById: session.user.id,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      fileSizeBytes: file.size,
      body: buffer,
      category: requiredDocumentId ? DocumentCategory.shipment : category,
      requiredDocumentId,
    });

    revalidateDocPaths(orderId);
    return { ok: true, documentId: document.id };
  } catch (error) {
    return { ok: false, error: mapError(error) };
  }
}

export async function getDocumentDownloadAction(
  documentId: string,
  orderId: string,
): Promise<DocumentActionResult> {
  try {
    const session = await requireRoles(VIEW_ROLES);
    await assertOrderDocumentAccess({
      orderId,
      role: session.user.role as Role,
      userId: session.user.id,
    });

    const { url, fileName } = await getDocumentDownloadUrl(
      documentId,
      session.user.id,
      orderId,
    );
    return { ok: true, url, fileName };
  } catch (error) {
    return { ok: false, error: mapError(error) };
  }
}
