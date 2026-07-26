import { DocumentChecklistStatus, OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ORDER_STATUS_LABELS } from "@/lib/rbac";

const STATUS_ORDER: OrderStatus[] = [
  OrderStatus.created,
  OrderStatus.booking_pending,
  OrderStatus.booked,
  OrderStatus.shipped,
  OrderStatus.customs_in_process,
  OrderStatus.customs_cleared,
  OrderStatus.costed,
  OrderStatus.closed,
];

export type OrdersByStatusPoint = {
  status: OrderStatus;
  label: string;
  count: number;
};

export type CycleTimePoint = {
  stage: string;
  label: string;
  averageDays: number;
};

export type LandedCostByMonthPoint = {
  month: string; // YYYY-MM
  label: string;
  total: number;
};

export type KpiSnapshot = {
  ordersByStatus: OrdersByStatusPoint[];
  averageCycleTimeDays: number | null;
  averageCycleTimeByStage: CycleTimePoint[];
  supplierComplianceRate: number;
  supplierCompliance: {
    totalShipmentOrders: number;
    ordersWithoutCorrections: number;
  };
  totalLandedCostByMonth: LandedCostByMonthPoint[];
  totals: {
    orders: number;
    closed: number;
    landedCostAllTime: number;
  };
};

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("es-ES", { month: "short", year: "numeric" });
}

/**
 * Aggregate operational KPIs for the reporting dashboard.
 */
export async function getKpis(): Promise<KpiSnapshot> {
  const [grouped, orders, shipmentOrders, costings] = await Promise.all([
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.order.findMany({
      select: {
        id: true,
        status: true,
        createdAt: true,
        statusHistory: {
          orderBy: { createdAt: "asc" },
          select: {
            previousStatus: true,
            newStatus: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.order.findMany({
      where: { shipment: { isNot: null } },
      select: {
        id: true,
        shipment: {
          select: {
            requiredDocuments: {
              select: { status: true },
            },
          },
        },
      },
    }),
    prisma.costingRecord.findMany({
      where: {
        OR: [{ closed: true }, { calculatedAt: { not: null } }],
      },
      select: {
        totalLandedCost: true,
        currency: true,
        calculatedAt: true,
        createdAt: true,
        closed: true,
      },
    }),
  ]);

  const countMap = new Map<OrderStatus, number>();
  for (const row of grouped) {
    countMap.set(row.status, row._count._all);
  }

  const ordersByStatus: OrdersByStatusPoint[] = STATUS_ORDER.map((status) => ({
    status,
    label: ORDER_STATUS_LABELS[status] ?? status,
    count: countMap.get(status) ?? 0,
  }));

  // Overall cycle time: created → closed
  const closedCycleDays: number[] = [];
  // Stage durations from consecutive status history rows
  const stageBuckets: Record<string, number[]> = {
    created_to_booked: [],
    booked_to_shipped: [],
    shipped_to_customs_cleared: [],
    customs_cleared_to_closed: [],
  };

  for (const order of orders) {
    const history = order.statusHistory;
    if (history.length === 0) continue;

    const createdAt = order.createdAt;
    const closedEvent = [...history].reverse().find((h) => h.newStatus === OrderStatus.closed);
    if (closedEvent) {
      closedCycleDays.push(daysBetween(createdAt, closedEvent.createdAt));
    }

    const first = (status: OrderStatus) =>
      history.find((h) => h.newStatus === status)?.createdAt;

    const bookedAt = first(OrderStatus.booked);
    const shippedAt = first(OrderStatus.shipped);
    const clearedAt = first(OrderStatus.customs_cleared);
    const closedAt = closedEvent?.createdAt;

    if (bookedAt) {
      stageBuckets.created_to_booked.push(daysBetween(createdAt, bookedAt));
    }
    if (bookedAt && shippedAt) {
      stageBuckets.booked_to_shipped.push(daysBetween(bookedAt, shippedAt));
    }
    if (shippedAt && clearedAt) {
      stageBuckets.shipped_to_customs_cleared.push(daysBetween(shippedAt, clearedAt));
    }
    if (clearedAt && closedAt) {
      stageBuckets.customs_cleared_to_closed.push(daysBetween(clearedAt, closedAt));
    }
  }

  const avg = (values: number[]) =>
    values.length === 0
      ? 0
      : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;

  const averageCycleTimeByStage: CycleTimePoint[] = [
    {
      stage: "created_to_booked",
      label: "Creada → Booking",
      averageDays: avg(stageBuckets.created_to_booked),
    },
    {
      stage: "booked_to_shipped",
      label: "Booking → Embarque",
      averageDays: avg(stageBuckets.booked_to_shipped),
    },
    {
      stage: "shipped_to_customs_cleared",
      label: "Embarque → Levante",
      averageDays: avg(stageBuckets.shipped_to_customs_cleared),
    },
    {
      stage: "customs_cleared_to_closed",
      label: "Levante → Cierre",
      averageDays: avg(stageBuckets.customs_cleared_to_closed),
    },
  ];

  const averageCycleTimeDays =
    closedCycleDays.length === 0 ? null : avg(closedCycleDays);

  // Supplier compliance: orders with shipment checklist that never had needs_correction
  let ordersWithoutCorrections = 0;
  for (const order of shipmentOrders) {
    const docs = order.shipment?.requiredDocuments ?? [];
    const hadCorrection = docs.some(
      (d) => d.status === DocumentChecklistStatus.needs_correction,
    );
    // Also treat historically corrected docs: if any still needs_correction OR
    // we only have current status. For compliance "without corrections", no doc
    // is currently needs_correction and at least one exists.
    if (docs.length > 0 && !hadCorrection) {
      ordersWithoutCorrections += 1;
    }
  }
  const totalShipmentOrders = shipmentOrders.filter(
    (o) => (o.shipment?.requiredDocuments.length ?? 0) > 0,
  ).length;
  const supplierComplianceRate =
    totalShipmentOrders === 0
      ? 100
      : Math.round((ordersWithoutCorrections / totalShipmentOrders) * 1000) / 10;

  // Landed cost by month
  const monthTotals = new Map<string, number>();
  let landedCostAllTime = 0;
  for (const c of costings) {
    const amount = Number(c.totalLandedCost.toString());
    landedCostAllTime += amount;
    const when = c.calculatedAt ?? c.createdAt;
    const key = monthKey(when);
    monthTotals.set(key, (monthTotals.get(key) ?? 0) + amount);
  }

  const totalLandedCostByMonth: LandedCostByMonthPoint[] = Array.from(
    monthTotals.entries(),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, total]) => ({
      month,
      label: monthLabel(month),
      total: Math.round(total * 100) / 100,
    }));

  return {
    ordersByStatus,
    averageCycleTimeDays,
    averageCycleTimeByStage,
    supplierComplianceRate,
    supplierCompliance: {
      totalShipmentOrders,
      ordersWithoutCorrections,
    },
    totalLandedCostByMonth,
    totals: {
      orders: orders.length,
      closed: countMap.get(OrderStatus.closed) ?? 0,
      landedCostAllTime: Math.round(landedCostAllTime * 100) / 100,
    },
  };
}

export type OrderExportRow = {
  orderNumber: string;
  sapReference: string | null;
  status: string;
  statusLabel: string;
  supplierName: string;
  supplierCountry: string;
  forwarderName: string | null;
  customsAgencyName: string | null;
  createdAt: string;
  lastActivityAt: string;
  totalLandedCost: string | null;
  currency: string | null;
  closedCosting: boolean;
};

export async function getOrdersForExport(): Promise<OrderExportRow[]> {
  const orders = await prisma.order.findMany({
    include: {
      supplier: { select: { name: true, country: true } },
      freightForwarder: { select: { name: true, companyName: true } },
      customsAgency: { select: { name: true, companyName: true } },
      costing: {
        select: {
          totalLandedCost: true,
          currency: true,
          closed: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return orders.map((o) => ({
    orderNumber: o.orderNumber,
    sapReference: o.sapReference,
    status: o.status,
    statusLabel: ORDER_STATUS_LABELS[o.status] ?? o.status,
    supplierName: o.supplier.name,
    supplierCountry: o.supplier.country,
    forwarderName:
      o.freightForwarder?.companyName || o.freightForwarder?.name || null,
    customsAgencyName:
      o.customsAgency?.companyName || o.customsAgency?.name || null,
    createdAt: o.createdAt.toISOString(),
    lastActivityAt: o.lastActivityAt.toISOString(),
    totalLandedCost: o.costing
      ? o.costing.totalLandedCost.toFixed(2)
      : null,
    currency: o.costing?.currency ?? null,
    closedCosting: o.costing?.closed ?? false,
  }));
}

/** Convert export rows to CSV string (UTF-8 with BOM for Excel) */
export function ordersToCsv(rows: OrderExportRow[]): string {
  const headers = [
    "orderNumber",
    "sapReference",
    "status",
    "statusLabel",
    "supplierName",
    "supplierCountry",
    "forwarderName",
    "customsAgencyName",
    "createdAt",
    "lastActivityAt",
    "totalLandedCost",
    "currency",
    "closedCosting",
  ];

  const escape = (value: string | boolean | null) => {
    if (value === null || value === undefined) return "";
    const s = String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((h) => escape(row[h as keyof OrderExportRow] as string | boolean | null)).join(","),
    ),
  ];

  return `\uFEFF${lines.join("\n")}`;
}

// Keep Prisma import used for typing if needed later
export type { Prisma };
