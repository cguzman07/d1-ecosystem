import { Suspense } from "react";
import Link from "next/link";
import { Role, type OrderStatus } from "@prisma/client";
import { Plus } from "lucide-react";
import { getSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { OrderFilters } from "@/features/orders/components/order-filters";
import { OrdersListTable } from "@/features/orders/components/orders-list-table";
import {
  getActiveSuppliers,
  getOrders,
  getSupplierIdForUser,
  scopeFiltersForRole,
} from "@/features/orders/service";

type SearchParams = {
  q?: string;
  status?: string;
  supplierId?: string;
  from?: string;
  to?: string;
  page?: string;
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session?.user) return null;

  const supplierIdLinked =
    session.user.role === "supplier"
      ? await getSupplierIdForUser(session.user.id)
      : null;

  const page = Math.max(1, Number(searchParams.page) || 1);
  const canManage =
    session.user.role === "admin" || session.user.role === "internal_specialist";

  const filters = scopeFiltersForRole(
    session.user.role as Role,
    session.user.id,
    {
      search: searchParams.q,
      status: (searchParams.status as OrderStatus) || undefined,
      supplierId: searchParams.supplierId,
      createdFrom: searchParams.from,
      createdTo: searchParams.to,
      page,
      pageSize: 20,
    },
    { supplierIdLinkedToUser: supplierIdLinked },
  );

  const [{ items, total, totalPages }, suppliers] = await Promise.all([
    getOrders(filters),
    canManage ? getActiveSuppliers() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="board-header">Módulo</p>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Órdenes de compra
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Listado completo con filtros y paginación
          </p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/orders/new">
              <Plus className="h-4 w-4" />
              Nueva orden
            </Link>
          </Button>
        )}
      </div>

      <Suspense fallback={null}>
        <OrderFilters
          basePath="/orders"
          showDateRange
          showSupplier={canManage}
          suppliers={suppliers}
        />
      </Suspense>

      <OrdersListTable
        orders={items}
        page={page}
        totalPages={totalPages}
        total={total}
        basePath="/orders"
        searchParams={{
          q: searchParams.q,
          status: searchParams.status,
          supplierId: searchParams.supplierId,
          from: searchParams.from,
          to: searchParams.to,
        }}
      />
    </div>
  );
}
