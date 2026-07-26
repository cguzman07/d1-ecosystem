import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { OrderWithAssignees } from "@/features/orders/service";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { Button } from "@/components/ui/button";

type Props = {
  orders: OrderWithAssignees[];
  page: number;
  totalPages: number;
  total: number;
  basePath?: string;
  searchParams?: Record<string, string | undefined>;
};

function buildHref(
  basePath: string,
  page: number,
  searchParams?: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== "page") params.set(k, v);
    }
  }
  params.set("page", String(page));
  return `${basePath}?${params.toString()}`;
}

export function OrdersListTable({
  orders,
  page,
  totalPages,
  total,
  basePath = "/orders",
  searchParams,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="board-panel overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-border font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Nº orden</th>
              <th className="px-4 py-3 font-medium">SAP</th>
              <th className="px-4 py-3 font-medium">Proveedor</th>
              <th className="px-4 py-3 font-medium">Agente</th>
              <th className="px-4 py-3 font-medium">Aduana</th>
              <th className="px-4 py-3 font-medium">Creación</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  No se encontraron órdenes
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-border hover:bg-primary/5"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/orders/${order.id}`}
                      className="font-mono font-medium text-primary hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {order.sapReference || "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground">{order.supplier.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {order.assignedFreightForwarder?.companyName ||
                      order.assignedFreightForwarder?.name ||
                      "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {order.assignedCustomsAgency?.companyName ||
                      order.assignedCustomsAgency?.name ||
                      "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {total} orden{total === 1 ? "" : "es"} · Página {page} de {totalPages}
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={buildHref(basePath, page - 1, searchParams)}>Anterior</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Anterior
            </Button>
          )}
          {page < totalPages ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={buildHref(basePath, page + 1, searchParams)}>Siguiente</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Siguiente
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
