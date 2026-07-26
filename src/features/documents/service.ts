import {
  DocumentCategory,
  DocumentChecklistStatus,
  DocumentStatus,
  NotificationType,
  Prisma,
  Role,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import {
  buildDocumentKey,
  ensureBucketExists,
  getPresignedDownloadUrl,
  uploadObject,
} from "@/lib/storage";
import { notify } from "@/features/notifications/service";
import { ensureShipmentForOrder } from "@/features/shipment/service";

export type UploadDocumentInput = {
  orderId: string;
  uploadedById: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  body: Buffer;
  category?: DocumentCategory;
  /** When set, fulfills a shipment checklist item */
  requiredDocumentId?: string | null;
};

const documentInclude = {
  uploadedBy: { select: { id: true, name: true, email: true, role: true } },
} satisfies Prisma.DocumentInclude;

export type DocumentWithUploader = Prisma.DocumentGetPayload<{
  include: typeof documentInclude;
}>;

export async function uploadDocument(input: UploadDocumentInput) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { supplier: true },
  });
  if (!order) throw new Error("ORDER_NOT_FOUND");

  let requiredDocumentId = input.requiredDocumentId ?? null;
  let category: DocumentCategory = input.category ?? DocumentCategory.general;
  let documentGroupId: string = randomUUID();
  let version = 1;

  if (requiredDocumentId) {
    await ensureShipmentForOrder(input.orderId);
    const required = await prisma.shipmentRequiredDocument.findUnique({
      where: { id: requiredDocumentId },
      include: {
        shipment: true,
        document: true,
      },
    });
    if (!required || required.shipment.orderId !== input.orderId) {
      throw new Error("REQUIRED_DOCUMENT_NOT_FOUND");
    }
    category = DocumentCategory.shipment;

    if (required.document?.documentGroupId) {
      documentGroupId = required.document.documentGroupId;
      const latest = await prisma.document.findFirst({
        where: { documentGroupId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      version = (latest?.version ?? 0) + 1;
    } else if (required.documentId) {
      // Link existing doc without group — create group and supersede
      documentGroupId = randomUUID();
      await prisma.document.update({
        where: { id: required.documentId },
        data: {
          documentGroupId,
          status: DocumentStatus.superseded,
        },
      });
      version = (required.document?.version ?? 1) + 1;
    }
  } else if (input.category) {
    // Version within same order + category + file stem group via latest active same name
    const activeSameName = await prisma.document.findFirst({
      where: {
        orderId: input.orderId,
        category: input.category,
        fileName: input.fileName,
        status: DocumentStatus.active,
      },
      orderBy: { version: "desc" },
    });
    if (activeSameName?.documentGroupId) {
      documentGroupId = activeSameName.documentGroupId;
      version = activeSameName.version + 1;
    } else if (activeSameName) {
      documentGroupId = randomUUID();
      await prisma.document.update({
        where: { id: activeSameName.id },
        data: { documentGroupId, status: DocumentStatus.superseded },
      });
      version = activeSameName.version + 1;
    }
  }

  await ensureBucketExists();
  const storageKey = buildDocumentKey(input.orderId, input.fileName, version);
  await uploadObject({
    key: storageKey,
    body: input.body,
    contentType: input.contentType || "application/octet-stream",
  });

  const document = await prisma.$transaction(async (tx) => {
    // Supersede previous active docs in the same group
    await tx.document.updateMany({
      where: {
        documentGroupId,
        status: DocumentStatus.active,
      },
      data: { status: DocumentStatus.superseded },
    });

    const created = await tx.document.create({
      data: {
        orderId: input.orderId,
        category,
        fileName: input.fileName,
        contentType: input.contentType || "application/octet-stream",
        storageKey,
        fileSizeBytes: input.fileSizeBytes,
        version,
        status: DocumentStatus.active,
        documentGroupId,
        uploadedById: input.uploadedById,
      },
      include: documentInclude,
    });

    if (requiredDocumentId) {
      await tx.shipmentRequiredDocument.update({
        where: { id: requiredDocumentId },
        data: {
          status: DocumentChecklistStatus.submitted,
          documentId: created.id,
          correctionReason: null,
          updatedById: input.uploadedById,
        },
      });
    }

    await tx.order.update({
      where: { id: input.orderId },
      data: { lastActivityAt: new Date() },
    });

    return created;
  });

  await notify({
    roles: [Role.internal_specialist, Role.admin],
    orderId: order.id,
    type: NotificationType.document_submitted,
    title: `Documento cargado — ${order.orderNumber}`,
    message: `Se cargó "${input.fileName}" (v${version}) en la orden ${order.orderNumber}.`,
    payload: {
      documentId: document.id,
      requiredDocumentId,
      category,
    },
    sendEmailChannel: true,
  });

  return document;
}

export async function getDocumentsByOrder(orderId: string) {
  const documents = await prisma.document.findMany({
    where: { orderId },
    include: documentInclude,
    orderBy: [{ category: "asc" }, { uploadedAt: "desc" }],
  });

  const grouped: Record<DocumentCategory, DocumentWithUploader[]> = {
    shipment: [],
    customs: [],
    costing: [],
    general: [],
  };

  for (const doc of documents) {
    grouped[doc.category].push(doc);
  }

  return { documents, grouped };
}

export async function getDocumentDownloadUrl(
  documentId: string,
  userId: string,
  expectedOrderId?: string,
) {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      order: { include: { supplier: true } },
    },
  });
  if (!doc) throw new Error("DOCUMENT_NOT_FOUND");

  if (expectedOrderId && doc.orderId !== expectedOrderId) {
    throw new Error("FORBIDDEN");
  }

  // Caller enforces RBAC; this just signs the URL
  void userId;
  const url = await getPresignedDownloadUrl(doc.storageKey, 3600);
  return { url, fileName: doc.fileName, contentType: doc.contentType, orderId: doc.orderId };
}

export async function assertOrderDocumentAccess(params: {
  orderId: string;
  role: Role;
  userId: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { supplier: true },
  });
  if (!order) throw new Error("ORDER_NOT_FOUND");

  if (params.role === Role.admin || params.role === Role.internal_specialist) {
    return order;
  }
  if (params.role === Role.supplier) {
    if (order.supplier.userId !== params.userId) throw new Error("FORBIDDEN");
    return order;
  }
  if (params.role === Role.freight_forwarder) {
    if (order.freightForwarderId !== params.userId) throw new Error("FORBIDDEN");
    return order;
  }
  if (params.role === Role.customs_agency) {
    if (order.customsAgencyId !== params.userId) throw new Error("FORBIDDEN");
    return order;
  }
  throw new Error("FORBIDDEN");
}
