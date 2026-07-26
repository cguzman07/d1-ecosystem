import type { OrderStatus } from "@prisma/client";

export type OrderListFilters = {
  status?: OrderStatus | OrderStatus[];
  supplierId?: string;
  freightForwarderId?: string;
  customsAgencyId?: string;
  search?: string;
  createdFrom?: Date | string;
  createdTo?: Date | string;
  /** When true, excludes closed orders (flight board) */
  excludeClosed?: boolean;
  page?: number;
  pageSize?: number;
};

export type CreateOrderInput = {
  supplierId: string;
  sapReference?: string | null;
  freightForwarderId?: string | null;
  customsAgencyId?: string | null;
  notes?: string | null;
  createdById: string;
};

export type SapOrderPayload = {
  sapReference: string;
  supplierId: string;
  freightForwarderId?: string | null;
  customsAgencyId?: string | null;
  notes?: string | null;
  /** System/user id that will own the create (e.g. integration service account) */
  createdById: string;
};

export type UpdateOrderStatusInput = {
  orderId: string;
  newStatus: OrderStatus;
  changedById: string;
  note?: string | null;
};
