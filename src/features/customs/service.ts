import {
  InspectionStatus,
  NotificationType,
  OrderStatus,
  Prisma,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { notify } from "@/features/notifications/service";

const customsInclude = {
  order: {
    include: {
      supplier: true,
      customsAgency: {
        select: { id: true, name: true, companyName: true, email: true },
      },
    },
  },
  customsAgency: {
    select: { id: true, name: true, companyName: true, email: true },
  },
} satisfies Prisma.CustomsRecordInclude;

export type CustomsDetail = Prisma.CustomsRecordGetPayload<{
  include: typeof customsInclude;
}>;

export type CustomsUpsertInput = {
  orderId: string;
  changedById: string;
  /** Acting customs agency user id (required on create) */
  customsAgencyId?: string | null;
  declarationNumber?: string | null;
  presentationDate?: Date | string | null;
  /** Levante / release date */
  levanteDate?: Date | string | null;
  inspectionStatus?: InspectionStatus;
  inspectionCompletionDate?: Date | string | null;
  notes?: string | null;
};

function parseDate(value?: Date | string | null): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Orders assigned to a customs agency that are currently in customs_in_process.
 */
export async function getCustomsByAgency(agencyUserId: string) {
  return prisma.order.findMany({
    where: {
      customsAgencyId: agencyUserId,
      status: OrderStatus.customs_in_process,
    },
    include: {
      supplier: true,
      customs: true,
      customsAgency: {
        select: { id: true, name: true, companyName: true },
      },
    },
    orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
  });
}

/**
 * Dashboard board: assigned orders in customs-relevant stages
 * (shipped → ready to start, in process, cleared).
 */
export async function getCustomsBoard(filters: {
  agencyUserId?: string;
  search?: string;
  /** When true, only customs_in_process (matches getCustomsByAgency) */
  inProcessOnly?: boolean;
}) {
  const statuses = filters.inProcessOnly
    ? [OrderStatus.customs_in_process]
    : [
        OrderStatus.shipped,
        OrderStatus.customs_in_process,
        OrderStatus.customs_cleared,
      ];

  const and: Prisma.OrderWhereInput[] = [{ status: { in: statuses } }];

  // Strict isolation: when scoped to an agency, only their assigned cases
  if (filters.agencyUserId) {
    and.push({ customsAgencyId: filters.agencyUserId });
  }

  if (filters.search?.trim()) {
    const q = filters.search.trim();
    and.push({
      OR: [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { supplier: { name: { contains: q, mode: "insensitive" } } },
        { sapReference: { contains: q, mode: "insensitive" } },
        { customs: { declarationNumber: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  return prisma.order.findMany({
    where: { AND: and },
    include: {
      supplier: true,
      customs: true,
      customsAgency: {
        select: { id: true, name: true, companyName: true },
      },
    },
    orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
}

export async function getCustomsByOrderId(
  orderId: string,
): Promise<CustomsDetail | null> {
  return prisma.customsRecord.findUnique({
    where: { orderId },
    include: customsInclude,
  });
}

export async function createOrUpdateCustomsRecord(input: CustomsUpsertInput) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { customs: true },
  });
  if (!order) throw new Error("ORDER_NOT_FOUND");

  const { assertCustomsCanRegister } = await import("@/features/orders/workflow");
  assertCustomsCanRegister({ status: order.status });

  const agencyId =
    input.customsAgencyId ||
    order.customs?.customsAgencyId ||
    order.customsAgencyId;

  if (!agencyId) {
    throw new Error("CUSTOMS_AGENCY_REQUIRED");
  }

  const existing = order.customs;
  const isCreate = !existing;

  const declarationNumber =
    input.declarationNumber !== undefined
      ? input.declarationNumber?.trim() || null
      : (existing?.declarationNumber ?? null);

  const presentationDate =
    input.presentationDate !== undefined
      ? parseDate(input.presentationDate)
      : (existing?.presentationDate ?? null);

  const releaseDate =
    input.levanteDate !== undefined
      ? parseDate(input.levanteDate)
      : (existing?.releaseDate ?? null);

  const inspectionStatus =
    input.inspectionStatus ??
    existing?.inspectionStatus ??
    InspectionStatus.not_required;

  let inspectionCompletedAt =
    input.inspectionCompletionDate !== undefined
      ? parseDate(input.inspectionCompletionDate)
      : (existing?.inspectionCompletedAt ?? null);

  if (
    inspectionStatus === InspectionStatus.completed &&
    !inspectionCompletedAt
  ) {
    inspectionCompletedAt = new Date();
  }
  if (inspectionStatus !== InspectionStatus.completed) {
    // Keep existing completion date only if still completed; otherwise clear when leaving completed
    if (input.inspectionStatus && input.inspectionStatus !== InspectionStatus.completed) {
      inspectionCompletedAt =
        input.inspectionCompletionDate !== undefined
          ? parseDate(input.inspectionCompletionDate)
          : null;
    }
  }

  const notes =
    input.notes !== undefined
      ? input.notes?.trim() || null
      : (existing?.notes ?? null);

  const levanteSetFirstTime = !existing?.releaseDate && !!releaseDate;
  const orderId = order.id;
  const initialOrderStatus = order.status;

  const changedFields: string[] = [];
  if (isCreate) {
    changedFields.push("created");
  } else if (existing) {
    if (existing.declarationNumber !== declarationNumber) {
      changedFields.push("declarationNumber");
    }
    if (
      (existing.presentationDate?.toISOString() ?? null) !==
      (presentationDate?.toISOString() ?? null)
    ) {
      changedFields.push("presentationDate");
    }
    if (
      (existing.releaseDate?.toISOString() ?? null) !==
      (releaseDate?.toISOString() ?? null)
    ) {
      changedFields.push("levanteDate");
    }
    if (existing.inspectionStatus !== inspectionStatus) {
      changedFields.push("inspectionStatus");
    }
    if (
      (existing.inspectionCompletedAt?.toISOString() ?? null) !==
      (inspectionCompletedAt?.toISOString() ?? null)
    ) {
      changedFields.push("inspectionCompletionDate");
    }
    if (existing.notes !== notes) changedFields.push("notes");
  }

  const result = await prisma.$transaction(async (tx) => {
    const record = isCreate
      ? await tx.customsRecord.create({
          data: {
            orderId,
            customsAgencyId: agencyId,
            declarationNumber,
            presentationDate,
            releaseDate,
            inspectionStatus,
            inspectionCompletedAt,
            notes,
          },
        })
      : await tx.customsRecord.update({
          where: { id: existing!.id },
          data: {
            customsAgencyId: agencyId,
            declarationNumber,
            presentationDate,
            releaseDate,
            inspectionStatus,
            inspectionCompletedAt,
            notes,
          },
        });

    let previousStatus = initialOrderStatus;
    let newOrderStatus = initialOrderStatus;

    async function advanceStatus(next: OrderStatus, note: string) {
      if (next === previousStatus) return;
      await tx.order.update({
        where: { id: orderId },
        data: { status: next, lastActivityAt: new Date() },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          previousStatus,
          newStatus: next,
          changedById: input.changedById,
          note,
        },
      });
      logger.statusTransition({
        orderId,
        previousStatus,
        newStatus: next,
        changedById: input.changedById,
      });
      previousStatus = next;
      newOrderStatus = next;
    }

    // Enter customs only from shipped (strict pipeline)
    if (initialOrderStatus === OrderStatus.shipped) {
      await advanceStatus(
        OrderStatus.customs_in_process,
        "Orden ingresó a proceso de aduana",
      );
    }

    // Levante → customs_cleared (history always includes in_process if jumped)
    if (levanteSetFirstTime) {
      if (previousStatus !== OrderStatus.customs_in_process) {
        await advanceStatus(
          OrderStatus.customs_in_process,
          "Orden ingresó a proceso de aduana",
        );
      }
      await advanceStatus(
        OrderStatus.customs_cleared,
        "Levante registrado — orden liberada de aduana",
      );
    }

    if (newOrderStatus === initialOrderStatus) {
      await tx.order.update({
        where: { id: orderId },
        data: { lastActivityAt: new Date() },
      });
    }

    return { record, previousStatus: initialOrderStatus, newOrderStatus };
  });

  const statusChanged = result.newOrderStatus !== result.previousStatus;
  const cleared = result.newOrderStatus === OrderStatus.customs_cleared;

  if (statusChanged || changedFields.length > 0) {
    const title = cleared
      ? `Aduana liberada (levante) — ${order.orderNumber}`
      : isCreate
        ? `Registro de aduana creado — ${order.orderNumber}`
        : `Aduana actualizada — ${order.orderNumber}`;

    const message = cleared
      ? `Se registró el levante de la orden ${order.orderNumber}. Estado: despacho aduanero completado (Levante).`
      : isCreate
        ? `La agencia de aduana inició el trámite de la orden ${order.orderNumber}.`
        : `Se actualizó el expediente aduanero de ${order.orderNumber} (${changedFields.join(", ")}).`;

    await notify({
      roles: [Role.admin, Role.internal_specialist],
      orderId: order.id,
      type: cleared
        ? NotificationType.customs_cleared
        : NotificationType.customs_updated,
      title,
      message,
      payload: {
        customsRecordId: result.record.id,
        declarationNumber,
        levanteDate: releaseDate?.toISOString() ?? null,
        inspectionStatus,
        orderStatus: result.newOrderStatus,
        changedFields,
      },
      sendEmailChannel: true,
    });
  }

  return getCustomsByOrderId(order.id);
}
