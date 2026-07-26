import {
  DocumentChecklistStatus,
  NotificationType,
  OrderStatus,
  Prisma,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { notify } from "@/features/notifications/service";
import { DEFAULT_SHIPMENT_DOCUMENTS } from "@/features/shipment/labels";

const shipmentInclude = {
  order: {
    include: {
      supplier: true,
      freightForwarder: {
        select: { id: true, name: true, companyName: true },
      },
    },
  },
  requiredDocuments: {
    orderBy: { createdAt: "asc" as const },
    include: {
      document: {
        include: {
          uploadedBy: { select: { id: true, name: true, email: true } },
        },
      },
      updatedBy: { select: { id: true, name: true, email: true } },
    },
  },
} satisfies Prisma.ShipmentRecordInclude;

export type ShipmentDetail = Prisma.ShipmentRecordGetPayload<{
  include: typeof shipmentInclude;
}>;

export async function getShipmentByOrderId(
  orderId: string,
): Promise<ShipmentDetail | null> {
  return prisma.shipmentRecord.findUnique({
    where: { orderId },
    include: shipmentInclude,
  });
}

export async function initializeShipmentRecord(
  orderId: string,
  notes?: string | null,
): Promise<ShipmentDetail> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("ORDER_NOT_FOUND");

  const existing = await prisma.shipmentRecord.findUnique({
    where: { orderId },
    include: shipmentInclude,
  });
  if (existing) return existing;

  await prisma.shipmentRecord.create({
    data: {
      orderId,
      notes: notes ?? null,
      requiredDocuments: {
        create: DEFAULT_SHIPMENT_DOCUMENTS.map((documentType) => ({
          documentType,
          status: DocumentChecklistStatus.pending,
        })),
      },
    },
  });

  await prisma.order.update({
    where: { id: orderId },
    data: { lastActivityAt: new Date() },
  });

  const created = await getShipmentByOrderId(orderId);
  if (!created) throw new Error("SHIPMENT_INIT_FAILED");
  return created;
}

export async function ensureShipmentForOrder(orderId: string): Promise<ShipmentDetail> {
  const existing = await getShipmentByOrderId(orderId);
  if (existing) return existing;
  return initializeShipmentRecord(orderId);
}

export type UpdateRequiredDocumentStatusInput = {
  requiredDocumentId: string;
  status: DocumentChecklistStatus;
  updatedById: string;
  correctionReason?: string | null;
  documentId?: string | null;
};

export async function updateRequiredDocumentStatus(
  input: UpdateRequiredDocumentStatusInput,
) {
  const required = await prisma.shipmentRequiredDocument.findUnique({
    where: { id: input.requiredDocumentId },
    include: {
      shipment: {
        include: {
          order: {
            include: {
              supplier: true,
            },
          },
        },
      },
    },
  });

  if (!required) throw new Error("REQUIRED_DOCUMENT_NOT_FOUND");

  if (
    input.status === DocumentChecklistStatus.needs_correction &&
    !input.correctionReason?.trim()
  ) {
    throw new Error("CORRECTION_REASON_REQUIRED");
  }

  const order = required.shipment.order;
  let supplierNotified = required.supplierNotified;

  if (input.status === DocumentChecklistStatus.needs_correction) {
    const recipientIds: string[] = [];
    if (order.supplier.userId) {
      recipientIds.push(order.supplier.userId);
    }

    await notify({
      recipientIds,
      roles: [Role.internal_specialist, Role.admin],
      orderId: order.id,
      type: NotificationType.document_needs_correction,
      title: `Documento requiere corrección — ${order.orderNumber}`,
      message: `El documento "${required.documentType}" de la orden ${order.orderNumber} requiere corrección: ${input.correctionReason!.trim()}`,
      payload: {
        requiredDocumentId: required.id,
        documentType: required.documentType,
        reason: input.correctionReason!.trim(),
      },
      sendEmailChannel: true,
      // Fallback when supplier portal user is not linked
      extraEmails: order.supplier.userId
        ? undefined
        : order.supplier.contactEmail
          ? [order.supplier.contactEmail]
          : undefined,
    });

    supplierNotified = Boolean(
      order.supplier.userId || order.supplier.contactEmail,
    );
  }

  const updated = await prisma.shipmentRequiredDocument.update({
    where: { id: input.requiredDocumentId },
    data: {
      status: input.status,
      correctionReason:
        input.status === DocumentChecklistStatus.needs_correction
          ? input.correctionReason!.trim()
          : input.status === DocumentChecklistStatus.approved ||
              input.status === DocumentChecklistStatus.submitted
            ? null
            : required.correctionReason,
      supplierNotified:
        input.status === DocumentChecklistStatus.needs_correction
          ? supplierNotified
          : required.supplierNotified,
      documentId:
        input.documentId !== undefined ? input.documentId : required.documentId,
      updatedById: input.updatedById,
    },
  });

  // After approval, if every required doc is approved → booking_pending (forwarder lane)
  if (input.status === DocumentChecklistStatus.approved) {
    const siblings = await prisma.shipmentRequiredDocument.findMany({
      where: { shipmentId: required.shipmentId },
      select: { status: true },
    });
    const allApproved =
      siblings.length > 0 &&
      siblings.every((d) => d.status === DocumentChecklistStatus.approved);

    if (allApproved && order.status === OrderStatus.created) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.booking_pending,
          lastActivityAt: new Date(),
        },
      });
      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          previousStatus: OrderStatus.created,
          newStatus: OrderStatus.booking_pending,
          changedById: input.updatedById,
          note: "Documentos de embarque aprobados — listo para booking",
        },
      });
    } else {
      await prisma.order.update({
        where: { id: required.shipment.orderId },
        data: { lastActivityAt: new Date() },
      });
    }
  } else {
    await prisma.order.update({
      where: { id: required.shipment.orderId },
      data: { lastActivityAt: new Date() },
    });
  }

  if (input.status === DocumentChecklistStatus.approved) {
    await notify({
      roles: [Role.internal_specialist, Role.freight_forwarder],
      recipientIds: [
        ...(order.supplier.userId ? [order.supplier.userId] : []),
        ...(order.freightForwarderId ? [order.freightForwarderId] : []),
      ],
      orderId: order.id,
      type: NotificationType.document_approved,
      title: `Documento aprobado — ${order.orderNumber}`,
      message: `El documento "${required.documentType}" de la orden ${order.orderNumber} fue aprobado.`,
      payload: { requiredDocumentId: required.id },
      sendEmailChannel: true,
      extraEmails: order.supplier.userId
        ? undefined
        : order.supplier.contactEmail
          ? [order.supplier.contactEmail]
          : undefined,
    });
  }

  return updated;
}

/**
 * Shipment-phase orders for the dashboard (booked / shipped / customs*).
 */
export async function getShipmentBoard(filters: {
  supplierId?: string;
  search?: string;
  alertOnly?: boolean;
  /** When true (supplier panel), only booked + shipped for that supplier */
  supplierScopeOnly?: boolean;
}) {
  const statuses = filters.supplierScopeOnly
    ? [OrderStatus.created, OrderStatus.booking_pending]
    : [
        OrderStatus.created,
        OrderStatus.booking_pending,
        OrderStatus.booked,
        OrderStatus.shipped,
        OrderStatus.customs_in_process,
        OrderStatus.customs_cleared,
      ];

  const and: Prisma.OrderWhereInput[] = [
    {
      status: {
        in: statuses,
      },
    },
  ];

  if (filters.supplierId) {
    and.push({ supplierId: filters.supplierId });
  }

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    and.push({
      OR: [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { supplier: { name: { contains: q, mode: "insensitive" } } },
        { sapReference: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const orders = await prisma.order.findMany({
    where: { AND: and },
    include: {
      supplier: true,
      shipment: {
        include: {
          requiredDocuments: true,
        },
      },
    },
    orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  const rows = orders.map((order) => {
    const docs = order.shipment?.requiredDocuments ?? [];
    const missing = docs.filter((d) => d.status === DocumentChecklistStatus.pending).length;
    const needsCorrection = docs.filter(
      (d) => d.status === DocumentChecklistStatus.needs_correction,
    ).length;
    const submitted = docs.filter(
      (d) => d.status === DocumentChecklistStatus.submitted,
    ).length;
    const approved = docs.filter(
      (d) => d.status === DocumentChecklistStatus.approved,
    ).length;
    const hasAlert = missing > 0 || needsCorrection > 0 || !order.shipment;

    return {
      ...order,
      checklist: { missing, needsCorrection, submitted, approved, total: docs.length },
      hasAlert,
    };
  });

  if (filters.alertOnly) {
    return rows.filter((r) => r.hasAlert);
  }

  return rows;
}
