import {
  NotificationType,
  OrderStatus,
  Prisma,
  Role,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { notify } from "@/features/notifications/service";
import {
  COST_CATEGORY_VALUES,
  isCostCategory,
  type CostCategoryValue,
} from "@/features/costing/labels";

const costingInclude = {
  lineItems: { orderBy: { createdAt: "asc" as const } },
  calculatedBy: { select: { id: true, name: true, email: true } },
  order: {
    include: {
      supplier: true,
    },
  },
} satisfies Prisma.CostingRecordInclude;

export type CostingDetail = Prisma.CostingRecordGetPayload<{
  include: typeof costingInclude;
}>;

export type CostingLineInput = {
  id?: string;
  category: string;
  description: string;
  amount: number | string;
  currency?: string;
};

export type CreateOrUpdateCostingInput = {
  orderId: string;
  changedById: string;
  notes?: string | null;
  currency?: string;
  /** Full replacement set of line items (add/edit/delete via replace) */
  lineItems: CostingLineInput[];
};

function toDecimal(value: number | string): Decimal {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (Number.isNaN(n)) return new Decimal(0);
  return new Decimal(n.toFixed(2));
}

function sumDecimals(values: Decimal[]): Decimal {
  return values.reduce((acc, v) => acc.add(v), new Decimal(0));
}

/**
 * Recalculate rollup fields and totalLandedCost from line items.
 * Totals are never trusted from manual input.
 */
export function computeCostRollups(lineItems: CostingLineInput[]) {
  const byCategory: Record<CostCategoryValue, Decimal[]> = {
    freight: [],
    customs: [],
    supplier_goods: [],
    other: [],
  };

  for (const item of lineItems) {
    const amount = toDecimal(item.amount);
    const category = isCostCategory(item.category) ? item.category : "other";
    byCategory[category].push(amount);
  }

  const freightCost = sumDecimals(byCategory.freight);
  const customsFees = sumDecimals(byCategory.customs);
  const supplierGoodsCost = sumDecimals(byCategory.supplier_goods);
  const otherCosts = sumDecimals(byCategory.other);
  const totalLandedCost = freightCost
    .add(customsFees)
    .add(supplierGoodsCost)
    .add(otherCosts);

  return {
    freightCost,
    customsFees,
    supplierGoodsCost,
    otherCosts,
    totalLandedCost,
  };
}

export async function getCostingByOrderId(
  orderId: string,
): Promise<CostingDetail | null> {
  return prisma.costingRecord.findUnique({
    where: { orderId },
    include: costingInclude,
  });
}

export async function getCostingBoard() {
  return prisma.order.findMany({
    where: {
      status: {
        in: [
          OrderStatus.customs_cleared,
          OrderStatus.costed,
          OrderStatus.closed,
        ],
      },
    },
    include: {
      supplier: true,
      costing: {
        include: { lineItems: true },
      },
    },
    orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
}

export async function createOrUpdateCostingRecord(
  input: CreateOrUpdateCostingInput,
) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { costing: true },
  });
  if (!order) throw new Error("ORDER_NOT_FOUND");

  if (order.costing?.closed) {
    throw new Error("COSTING_CLOSED");
  }

  if (!order.costing && order.status !== OrderStatus.customs_cleared) {
    throw new Error("ORDER_NOT_READY_FOR_COSTING");
  }

  const normalized = input.lineItems
    .map((item) => ({
      id: item.id,
      category: isCostCategory(item.category) ? item.category : "other",
      description: item.description.trim(),
      amount: toDecimal(item.amount),
      currency: (item.currency || input.currency || "USD").trim() || "USD",
    }))
    .filter((item) => item.description.length > 0);

  const rollups = computeCostRollups(
    normalized.map((i) => ({
      category: i.category,
      description: i.description,
      amount: i.amount.toNumber(),
      currency: i.currency,
    })),
  );

  const currency = input.currency?.trim() || normalized[0]?.currency || "USD";
  const notes =
    input.notes !== undefined
      ? input.notes?.trim() || null
      : (order.costing?.notes ?? null);

  await prisma.$transaction(async (tx) => {
    const costing = order.costing
      ? await tx.costingRecord.update({
          where: { id: order.costing.id },
          data: {
            ...rollups,
            currency,
            notes,
          },
        })
      : await tx.costingRecord.create({
          data: {
            orderId: order.id,
            ...rollups,
            currency,
            notes,
            closed: false,
          },
        });

    // Replace line items atomically
    await tx.costingLineItem.deleteMany({ where: { costingId: costing.id } });

    if (normalized.length > 0) {
      await tx.costingLineItem.createMany({
        data: normalized.map((item) => ({
          costingId: costing.id,
          category: item.category,
          description: item.description,
          amount: item.amount,
          currency: item.currency,
        })),
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: { lastActivityAt: new Date() },
    });
  });

  return getCostingByOrderId(order.id);
}

export async function finalizeCosting(params: {
  orderId: string;
  calculatedById: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: { costing: { include: { lineItems: true } } },
  });

  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (!order.costing) throw new Error("COSTING_NOT_FOUND");
  if (order.costing.closed) throw new Error("COSTING_ALREADY_FINALIZED");
  if (order.costing.lineItems.length === 0) {
    throw new Error("COSTING_LINE_ITEMS_REQUIRED");
  }
  if (
    order.status !== OrderStatus.customs_cleared &&
    order.status !== OrderStatus.costed
  ) {
    throw new Error("ORDER_NOT_READY_FOR_COSTING");
  }

  // Recompute from current line items before locking
  const rollups = computeCostRollups(
    order.costing.lineItems.map((i) => ({
      category: i.category,
      description: i.description,
      amount: i.amount.toNumber(),
      currency: i.currency,
    })),
  );

  await prisma.$transaction(async (tx) => {
    await tx.costingRecord.update({
      where: { id: order.costing!.id },
      data: {
        ...rollups,
        calculatedAt: new Date(),
        calculatedById: params.calculatedById,
        closed: true,
      },
    });

    // costed
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.costed,
        lastActivityAt: new Date(),
      },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        previousStatus: order.status,
        newStatus: OrderStatus.costed,
        changedById: params.calculatedById,
        note: "Costeo finalizado",
      },
    });
    logger.statusTransition({
      orderId: order.id,
      previousStatus: order.status,
      newStatus: OrderStatus.costed,
      changedById: params.calculatedById,
    });

    // then immediately closed
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.closed,
        lastActivityAt: new Date(),
      },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        previousStatus: OrderStatus.costed,
        newStatus: OrderStatus.closed,
        changedById: params.calculatedById,
        note: "Orden cerrada tras costeo",
      },
    });
    logger.statusTransition({
      orderId: order.id,
      previousStatus: OrderStatus.costed,
      newStatus: OrderStatus.closed,
      changedById: params.calculatedById,
    });
  });

  const total = rollups.totalLandedCost.toFixed(2);

  await notify({
    roles: [Role.admin, Role.internal_specialist],
    orderId: order.id,
    type: NotificationType.order_closed,
    title: `Orden cerrada — ${order.orderNumber}`,
    message: `El costeo de la orden ${order.orderNumber} fue finalizado. Costo total aterrizado: ${total} ${order.costing.currency}. La orden quedó costeada y cerrada.`,
    payload: {
      totalLandedCost: total,
      currency: order.costing.currency,
      costingId: order.costing.id,
    },
    sendEmailChannel: true,
  });

  return getCostingByOrderId(order.id);
}

export { COST_CATEGORY_VALUES };
