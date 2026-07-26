import {
  BookingStatus,
  NotificationType,
  OrderStatus,
  Prisma,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { notify } from "@/features/notifications/service";

export type BookingListFilters = {
  status?: BookingStatus;
  forwarderId?: string;
  page?: number;
  pageSize?: number;
};

export type BookingUpsertInput = {
  orderId: string;
  changedById: string;
  /** SARPE */
  departureDate?: Date | string | null;
  arrivalDate?: Date | string | null;
  containerNumbers?: string[];
  carrier?: string | null;
  status?: BookingStatus;
};

const bookingDetailInclude = {
  order: {
    include: {
      supplier: true,
      freightForwarder: {
        select: { id: true, name: true, companyName: true, email: true },
      },
      createdBy: { select: { id: true, name: true, email: true, role: true } },
    },
  },
  revisions: {
    orderBy: { createdAt: "desc" as const },
    include: {
      changedBy: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  },
} satisfies Prisma.BookingInclude;

const bookingListInclude = {
  order: {
    include: {
      supplier: true,
      freightForwarder: {
        select: { id: true, name: true, companyName: true, email: true },
      },
    },
  },
} satisfies Prisma.BookingInclude;

export type BookingDetail = Prisma.BookingGetPayload<{
  include: typeof bookingDetailInclude;
}>;

function parseDate(value?: Date | string | null): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function serializeDate(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function serializeContainers(value: string[] | undefined | null): string {
  return (value ?? []).join(", ");
}

function normalizeContainers(raw?: string[]): string[] {
  if (!raw) return [];
  return raw
    .map((c) => c.trim())
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);
}

function valuesEqual(a: string | null, b: string | null): boolean {
  return (a ?? "") === (b ?? "");
}

export async function getBookings(filters: BookingListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));

  const where: Prisma.BookingWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.forwarderId) {
    where.order = { freightForwarderId: filters.forwarderId };
  }

  const [total, items] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      include: bookingListInclude,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getBookingByOrderId(orderId: string): Promise<BookingDetail | null> {
  return prisma.booking.findUnique({
    where: { orderId },
    include: bookingDetailInclude,
  });
}

/**
 * Board rows: assigned orders with booking status (missing booking = no_booking).
 * When `forwarderId` is set, only that freight forwarder's orders are returned.
 */
export async function getBookingBoard(filters: {
  status?: BookingStatus | "all";
  forwarderId?: string;
  search?: string;
}) {
  const and: Prisma.OrderWhereInput[] = [{ status: { not: OrderStatus.closed } }];

  if (filters.forwarderId) {
    and.push({ freightForwarderId: filters.forwarderId });
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

  if (filters.status && filters.status !== "all") {
    if (filters.status === BookingStatus.no_booking) {
      and.push({
        OR: [{ booking: null }, { booking: { status: BookingStatus.no_booking } }],
      });
    } else {
      and.push({ booking: { status: filters.status } });
    }
  }

  const orders = await prisma.order.findMany({
    where: { AND: and },
    include: {
      supplier: true,
      freightForwarder: {
        select: { id: true, name: true, companyName: true },
      },
      booking: true,
      shipment: {
        include: {
          requiredDocuments: { select: { status: true } },
        },
      },
    },
    orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  const { docsApprovedFromShipment, isBookingActionReady } = await import(
    "@/features/orders/workflow"
  );

  return orders.map((order) => {
    const shipmentDocsApproved = docsApprovedFromShipment(order.shipment);
    return {
      ...order,
      bookingStatus: order.booking?.status ?? BookingStatus.no_booking,
      shipmentDocsApproved,
      workflowReady: isBookingActionReady(order.status, shipmentDocsApproved),
    };
  });
}

type TrackedField = "departureDate" | "arrivalDate" | "containerNumbers" | "carrier" | "status";

function collectRevisions(params: {
  bookingId: string;
  changedById: string;
  before: {
    departureDate: Date | null;
    arrivalDate: Date | null;
    containerNumbers: string[];
    carrier: string | null;
    status: BookingStatus;
  } | null;
  after: {
    departureDate: Date | null;
    arrivalDate: Date | null;
    containerNumbers: string[];
    carrier: string | null;
    status: BookingStatus;
  };
}): Prisma.BookingRevisionCreateManyInput[] {
  const { bookingId, changedById, before, after } = params;
  const fields: TrackedField[] = [
    "departureDate",
    "arrivalDate",
    "containerNumbers",
    "carrier",
    "status",
  ];

  const revisions: Prisma.BookingRevisionCreateManyInput[] = [];

  for (const field of fields) {
    let oldValue: string | null = null;
    let newValue: string | null = null;

    if (field === "departureDate" || field === "arrivalDate") {
      oldValue = before ? serializeDate(before[field]) : null;
      newValue = serializeDate(after[field]);
    } else if (field === "containerNumbers") {
      oldValue = before ? serializeContainers(before.containerNumbers) : null;
      newValue = serializeContainers(after.containerNumbers);
    } else if (field === "carrier") {
      oldValue = before?.carrier ?? null;
      newValue = after.carrier;
    } else {
      oldValue = before?.status ?? null;
      newValue = after.status;
    }

    if (!valuesEqual(oldValue, newValue)) {
      revisions.push({
        bookingId,
        fieldName: field,
        oldValue,
        newValue,
        changedById,
      });
    }
  }

  return revisions;
}

export async function createOrUpdateBooking(input: BookingUpsertInput) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: {
      booking: true,
      createdBy: true,
      shipment: { include: { requiredDocuments: { select: { status: true } } } },
    },
  });

  if (!order) {
    throw new Error("ORDER_NOT_FOUND");
  }

  const { docsApprovedFromShipment, assertForwarderCanRegisterBooking } =
    await import("@/features/orders/workflow");
  const shipmentDocsApproved = docsApprovedFromShipment(order.shipment);
  assertForwarderCanRegisterBooking({
    status: order.status,
    shipmentDocsApproved,
  });

  const departureDate =
    input.departureDate !== undefined
      ? parseDate(input.departureDate)
      : (order.booking?.departureDate ?? null);
  const arrivalDate =
    input.arrivalDate !== undefined
      ? parseDate(input.arrivalDate)
      : (order.booking?.arrivalDate ?? null);
  const containerNumbers =
    input.containerNumbers !== undefined
      ? normalizeContainers(input.containerNumbers)
      : (order.booking?.containerNumbers ?? []);
  const carrier =
    input.carrier !== undefined
      ? input.carrier?.trim() || null
      : (order.booking?.carrier ?? null);

  // Pipeline: SARPE → with_booking / booked; arrival → shipped
  let status =
    input.status ?? order.booking?.status ?? BookingStatus.no_booking;
  if (arrivalDate) {
    status = BookingStatus.shipped;
  } else if (departureDate) {
    status = BookingStatus.with_booking;
  }

  const after = {
    departureDate,
    arrivalDate,
    containerNumbers,
    carrier,
    status,
  };

  const isCreate = !order.booking;
  let notificationType: NotificationType = NotificationType.booking_updated;
  const orderId = order.id;
  const initialOrderStatus = order.status;
  const existingBooking = order.booking;

  const result = await prisma.$transaction(async (tx) => {
    let booking;

    if (isCreate) {
      notificationType = NotificationType.booking_created;
      booking = await tx.booking.create({
        data: {
          orderId,
          departureDate,
          arrivalDate,
          containerNumbers,
          carrier,
          status,
        },
      });
    } else {
      booking = await tx.booking.update({
        where: { id: existingBooking!.id },
        data: {
          departureDate,
          arrivalDate,
          containerNumbers,
          carrier,
          status,
        },
      });
    }

    const revisions = collectRevisions({
      bookingId: booking.id,
      changedById: input.changedById,
      before: existingBooking
        ? {
            departureDate: existingBooking.departureDate,
            arrivalDate: existingBooking.arrivalDate,
            containerNumbers: existingBooking.containerNumbers,
            carrier: existingBooking.carrier,
            status: existingBooking.status,
          }
        : null,
      after,
    });

    if (revisions.length > 0) {
      await tx.bookingRevision.createMany({ data: revisions });
    }

    let currentStatus = initialOrderStatus;

    async function advanceOrder(next: OrderStatus, note: string) {
      if (next === currentStatus) return;
      const previous = currentStatus;
      currentStatus = next;
      await tx.order.update({
        where: { id: orderId },
        data: { status: currentStatus, lastActivityAt: new Date() },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          previousStatus: previous,
          newStatus: currentStatus,
          changedById: input.changedById,
          note,
        },
      });
      logger.statusTransition({
        orderId,
        previousStatus: previous,
        newStatus: currentStatus,
        changedById: input.changedById,
      });
    }

    // SARPE registered → booked
    if (
      departureDate &&
      (currentStatus === OrderStatus.created ||
        currentStatus === OrderStatus.booking_pending)
    ) {
      await advanceOrder(
        OrderStatus.booked,
        "Estado actualizado por registro de SARPE / booking",
      );
    }

    // Arrival set → shipped
    if (
      arrivalDate &&
      (currentStatus === OrderStatus.booked ||
        currentStatus === OrderStatus.booking_pending ||
        currentStatus === OrderStatus.created)
    ) {
      if (currentStatus !== OrderStatus.booked) {
        await advanceOrder(OrderStatus.booked, "Booking registrado antes de embarque");
      }
      await advanceOrder(
        OrderStatus.shipped,
        "Estado actualizado: fecha de arribo registrada (embarque)",
      );
    }

    if (currentStatus === initialOrderStatus) {
      await tx.order.update({
        where: { id: orderId },
        data: { lastActivityAt: new Date() },
      });
    }

    return booking;
  });

  const title = isCreate
    ? `Booking creado — ${order.orderNumber}`
    : `Booking actualizado — ${order.orderNumber}`;
  const message = isCreate
    ? `Se registró el booking de la orden ${order.orderNumber} (naviera: ${carrier || "N/D"}, estado: ${status}).`
    : `Se actualizó el booking de la orden ${order.orderNumber} (roleo/cambio registrado). Estado booking: ${status}.`;

  await notify({
    roles: [Role.admin, Role.internal_specialist],
    orderId: order.id,
    type: notificationType,
    title,
    message,
    payload: {
      bookingId: result.id,
      orderNumber: order.orderNumber,
      status,
      isCreate,
    },
    sendEmailChannel: true,
  });

  return getBookingByOrderId(order.id);
}
