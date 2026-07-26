import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrderStatus } from "@prisma/client";

const {
  mockSupplierFindFirst,
  mockUserFindFirst,
  mockOrderFindUnique,
  mockTransaction,
  mockStatusTransition,
} = vi.hoisted(() => ({
  mockSupplierFindFirst: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockOrderFindUnique: vi.fn(),
  mockTransaction: vi.fn(),
  mockStatusTransition: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    supplier: { findFirst: mockSupplierFindFirst },
    user: { findFirst: mockUserFindFirst },
    order: { findUnique: mockOrderFindUnique },
    $transaction: mockTransaction,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    statusTransition: mockStatusTransition,
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    notificationSent: vi.fn(),
  },
}));

import { createOrder, updateOrderStatus } from "@/features/orders/service";

describe("createOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates sequential order numbers and logs initial status history", async () => {
    mockSupplierFindFirst.mockResolvedValue({
      id: "sup-1",
      active: true,
      name: "Proveedor Demo",
    });

    const createdOrder = {
      id: "ord-1",
      orderNumber: "ORD-2026-002",
      status: OrderStatus.created,
      supplierId: "sup-1",
      createdById: "user-1",
    };

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        order: {
          findFirst: vi.fn().mockResolvedValue({
            orderNumber: "ORD-2026-001",
          }),
          create: vi.fn().mockImplementation(
            async ({
              data,
            }: {
              data: {
                orderNumber: string;
                statusHistory: { create: Record<string, unknown> };
              };
            }) => {
              expect(data.orderNumber).toBe("ORD-2026-002");
              expect(data.statusHistory.create).toMatchObject({
                previousStatus: null,
                newStatus: OrderStatus.created,
                changedById: "user-1",
              });
              return createdOrder;
            },
          ),
        },
      };
      return fn(tx);
    });

    const order = await createOrder({
      supplierId: "sup-1",
      createdById: "user-1",
      notes: "Prueba",
    });

    expect(order.orderNumber).toBe("ORD-2026-002");
    expect(mockStatusTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "ord-1",
        previousStatus: null,
        newStatus: OrderStatus.created,
        changedById: "user-1",
      }),
    );
  });

  it("rejects inactive or missing suppliers", async () => {
    mockSupplierFindFirst.mockResolvedValue(null);
    await expect(
      createOrder({ supplierId: "missing", createdById: "user-1" }),
    ).rejects.toThrow("SUPPLIER_NOT_FOUND");
  });
});

describe("updateOrderStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes OrderStatusHistory when status changes", async () => {
    mockOrderFindUnique.mockResolvedValue({
      id: "ord-1",
      status: OrderStatus.created,
    });

    const historyCreate = vi.fn().mockResolvedValue({});
    const orderUpdate = vi.fn().mockResolvedValue({
      id: "ord-1",
      status: OrderStatus.booking_pending,
    });

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        order: { update: orderUpdate },
        orderStatusHistory: { create: historyCreate },
      };
      return fn(tx);
    });

    const updated = await updateOrderStatus({
      orderId: "ord-1",
      newStatus: OrderStatus.booking_pending,
      changedById: "user-1",
      note: "Asignación",
    });

    expect(updated.status).toBe(OrderStatus.booking_pending);
    expect(historyCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "ord-1",
        previousStatus: OrderStatus.created,
        newStatus: OrderStatus.booking_pending,
        changedById: "user-1",
        note: "Asignación",
      }),
    });
  });
});
