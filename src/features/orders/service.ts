import {
  OrderStatus,
  Prisma,
  Role,
  type Order,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type {
  CreateOrderInput,
  OrderListFilters,
  SapOrderPayload,
  UpdateOrderStatusInput,
} from "./types";

const orderListInclude = {
  supplier: true,
  freightForwarder: {
    select: { id: true, name: true, email: true, companyName: true, role: true },
  },
  customsAgency: {
    select: { id: true, name: true, email: true, companyName: true, role: true },
  },
} satisfies Prisma.OrderInclude;

const orderDetailInclude = {
  supplier: true,
  freightForwarder: {
    select: { id: true, name: true, email: true, companyName: true, role: true },
  },
  customsAgency: {
    select: { id: true, name: true, email: true, companyName: true, role: true },
  },
  createdBy: {
    select: { id: true, name: true, email: true, role: true },
  },
  statusHistory: {
    orderBy: { createdAt: "asc" as const },
    include: {
      changedBy: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  },
  booking: true,
  shipment: { include: { requiredDocuments: true } },
  customs: true,
  costing: { include: { lineItems: true } },
  documents: {
    where: { status: "active" },
    orderBy: { uploadedAt: "desc" as const },
  },
} satisfies Prisma.OrderInclude;

export type OrderListItem = Prisma.OrderGetPayload<{ include: typeof orderListInclude }>;
export type OrderDetail = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

/** Aliases matching the milestone brief (same relations as schema) */
export type OrderWithAssignees = OrderListItem & {
  assignedFreightForwarder: OrderListItem["freightForwarder"];
  assignedCustomsAgency: OrderListItem["customsAgency"];
};

function withAssigneeAliases<T extends OrderListItem>(order: T): T & {
  assignedFreightForwarder: T["freightForwarder"];
  assignedCustomsAgency: T["customsAgency"];
} {
  return {
    ...order,
    assignedFreightForwarder: order.freightForwarder,
    assignedCustomsAgency: order.customsAgency,
  };
}

function parseDate(value?: Date | string): Date | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function buildWhere(filters: OrderListFilters): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};

  if (filters.excludeClosed) {
    where.status = { not: OrderStatus.closed };
  }

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    where.status = filters.excludeClosed
      ? { in: statuses.filter((s) => s !== OrderStatus.closed) }
      : { in: statuses };
  }

  if (filters.supplierId) {
    where.supplierId = filters.supplierId;
  }

  if (filters.freightForwarderId) {
    where.freightForwarderId = filters.freightForwarderId;
  }

  if (filters.customsAgencyId) {
    where.customsAgencyId = filters.customsAgencyId;
  }

  const from = parseDate(filters.createdFrom);
  const to = parseDate(filters.createdTo);
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const search = filters.search?.trim();
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { sapReference: { contains: search, mode: "insensitive" } },
      { notes: { contains: search, mode: "insensitive" } },
      { supplier: { name: { contains: search, mode: "insensitive" } } },
      { freightForwarder: { name: { contains: search, mode: "insensitive" } } },
      { freightForwarder: { companyName: { contains: search, mode: "insensitive" } } },
      { customsAgency: { name: { contains: search, mode: "insensitive" } } },
      { customsAgency: { companyName: { contains: search, mode: "insensitive" } } },
    ];
  }

  return where;
}

/**
 * Role-scoped visibility for list/detail queries.
 */
export function scopeFiltersForRole(
  role: Role,
  userId: string,
  filters: OrderListFilters = {},
  opts?: { supplierIdLinkedToUser?: string | null },
): OrderListFilters {
  if (role === Role.admin || role === Role.internal_specialist) {
    return filters;
  }
  if (role === Role.freight_forwarder) {
    return { ...filters, freightForwarderId: userId };
  }
  if (role === Role.customs_agency) {
    return { ...filters, customsAgencyId: userId };
  }
  if (role === Role.supplier) {
    if (opts?.supplierIdLinkedToUser) {
      return { ...filters, supplierId: opts.supplierIdLinkedToUser };
    }
    // No linked supplier → empty result via impossible id
    return { ...filters, supplierId: "__none__" };
  }
  return filters;
}

export async function getOrders(filters: OrderListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const where = buildWhere(filters);

  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: orderListInclude,
      orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const items = rows.map(withAssigneeAliases);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getOrderById(id: string): Promise<
  | (OrderDetail & {
      assignedFreightForwarder: OrderDetail["freightForwarder"];
      assignedCustomsAgency: OrderDetail["customsAgency"];
    })
  | null
> {
  const order = await prisma.order.findUnique({
    where: { id },
    include: orderDetailInclude,
  });
  if (!order) return null;
  return withAssigneeAliases(order);
}

async function generateOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}-`;

  const latest = await tx.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });

  let next = 1;
  if (latest?.orderNumber) {
    const raw = latest.orderNumber.slice(prefix.length);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed)) next = parsed + 1;
  }

  return `${prefix}${String(next).padStart(3, "0")}`;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const supplier = await prisma.supplier.findFirst({
    where: { id: input.supplierId, active: true },
  });
  if (!supplier) {
    throw new Error("SUPPLIER_NOT_FOUND");
  }

  if (input.freightForwarderId) {
    const forwarder = await prisma.user.findFirst({
      where: {
        id: input.freightForwarderId,
        role: Role.freight_forwarder,
        active: true,
      },
    });
    if (!forwarder) throw new Error("FORWARDER_NOT_FOUND");
  }

  if (input.customsAgencyId) {
    const agency = await prisma.user.findFirst({
      where: {
        id: input.customsAgencyId,
        role: Role.customs_agency,
        active: true,
      },
    });
    if (!agency) throw new Error("CUSTOMS_AGENCY_NOT_FOUND");
  }

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await generateOrderNumber(tx);
    const now = new Date();

    const created = await tx.order.create({
      data: {
        orderNumber,
        sapReference: input.sapReference?.trim() || null,
        supplierId: input.supplierId,
        freightForwarderId: input.freightForwarderId || null,
        customsAgencyId: input.customsAgencyId || null,
        notes: input.notes?.trim() || null,
        createdById: input.createdById,
        status: OrderStatus.created,
        lastActivityAt: now,
        statusHistory: {
          create: {
            previousStatus: null,
            newStatus: OrderStatus.created,
            changedById: input.createdById,
            note: "Orden creada",
          },
        },
      },
    });

    return created;
  });

  logger.statusTransition({
    orderId: order.id,
    previousStatus: null,
    newStatus: OrderStatus.created,
    changedById: input.createdById,
  });

  return order;
}

/**
 * Future SAP webhook entry point — maps inbound payload into createOrder.
 * Unused in UI today; kept as the clean integration seam.
 */
export async function createOrderFromSap(payload: SapOrderPayload): Promise<Order> {
  if (!payload.sapReference?.trim()) {
    throw new Error("SAP_REFERENCE_REQUIRED");
  }

  return createOrder({
    sapReference: payload.sapReference.trim(),
    supplierId: payload.supplierId,
    freightForwarderId: payload.freightForwarderId,
    customsAgencyId: payload.customsAgencyId,
    notes: payload.notes ?? `Importada desde SAP (${payload.sapReference})`,
    createdById: payload.createdById,
  });
}

export async function updateOrderStatus(input: UpdateOrderStatusInput): Promise<Order> {
  const existing = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!existing) {
    throw new Error("ORDER_NOT_FOUND");
  }

  if (existing.status === input.newStatus) {
    return existing;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.order.update({
      where: { id: input.orderId },
      data: {
        status: input.newStatus,
        lastActivityAt: new Date(),
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: input.orderId,
        previousStatus: existing.status,
        newStatus: input.newStatus,
        changedById: input.changedById,
        note: input.note?.trim() || null,
      },
    });

    return order;
  });

  logger.statusTransition({
    orderId: updated.id,
    previousStatus: existing.status,
    newStatus: input.newStatus,
    changedById: input.changedById,
  });

  return updated;
}

export async function getActiveSuppliers() {
  return prisma.supplier.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true, country: true },
  });
}

export async function getAssignableForwarders() {
  return prisma.user.findMany({
    where: { role: Role.freight_forwarder, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, companyName: true },
  });
}

export async function getAssignableCustomsAgencies() {
  return prisma.user.findMany({
    where: { role: Role.customs_agency, active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, companyName: true },
  });
}

export async function getSupplierIdForUser(userId: string): Promise<string | null> {
  const supplier = await prisma.supplier.findFirst({
    where: { userId },
    select: { id: true },
  });
  return supplier?.id ?? null;
}

const calendarOrderInclude = {
  supplier: { select: { id: true, name: true } },
  freightForwarder: {
    select: { id: true, name: true, companyName: true },
  },
  customsAgency: {
    select: { id: true, name: true, companyName: true },
  },
  booking: {
    select: {
      departureDate: true,
      arrivalDate: true,
      status: true,
      carrier: true,
      containerNumbers: true,
    },
  },
  customs: {
    select: {
      releaseDate: true,
      presentationDate: true,
      declarationNumber: true,
    },
  },
  shipment: {
    select: {
      requiredDocuments: {
        select: {
          id: true,
          documentType: true,
          status: true,
        },
        orderBy: { documentType: "asc" as const },
      },
    },
  },
  costing: {
    select: {
      closed: true,
      calculatedAt: true,
      totalLandedCost: true,
      currency: true,
    },
  },
} satisfies Prisma.OrderInclude;

export type CalendarOrderRow = Prisma.OrderGetPayload<{
  include: typeof calendarOrderInclude;
}>;

/**
 * Orders for the interactive calendar dashboard (role-scoped).
 * Includes booking / customs / shipment / costing for event dates and case modal.
 */
export async function getCalendarOrders(filters: OrderListFilters = {}) {
  const where = buildWhere(filters);
  const rows = await prisma.order.findMany({
    where,
    include: calendarOrderInclude,
    orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
    take: 300,
  });
  return rows;
}

export { isStaleEarlyStage, ORDER_STATUS_VALUES } from "./status";
