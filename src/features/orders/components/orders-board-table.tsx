import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { OrderWithAssignees } from "@/features/orders/service";
import { isStaleEarlyStage } from "@/features/orders/status";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { StaleAlertIcon } from "@/features/orders/components/stale-alert-icon";

type Props = {
  orders: OrderWithAssignees[];
  staleDays?: number;
  emptyMessage?: string;
};

export function OrdersBoardTable({
  orders,
  staleDays = 3,
  emptyMessage = "No hay órdenes activas",
}: Props) {
  return (
    <div className="board-panel overflow-hidden">
      <div className="grid grid-cols-[1.1fr_1.2fr_1fr_1fr_0.9fr_0.9fr_0.5fr] gap-2 border-b border-border bg-muted/50 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Nº orden</span>
        <span>Proveedor</span>
        <span>Agente carga</span>
        <span>Aduana</span>
        <span>Creación</span>
        <span>Estado</span>
        <span>Alertas</span>
      </div>

      {orders.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">{emptyMessage}</div>
      ) : (
        orders.map((order) => {
          const stale = isStaleEarlyStage(order, staleDays);
          return (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="grid grid-cols-[1.1fr_1.2fr_1fr_1fr_0.9fr_0.9fr_0.5fr] gap-2 border-b border-border px-4 py-3 text-sm transition-colors hover:bg-primary/5 last:border-0"
            >
              <span className="font-mono font-medium text-primary">{order.orderNumber}</span>
              <span className="truncate text-foreground">{order.supplier.name}</span>
              <span className="truncate text-muted-foreground">
                {order.assignedFreightForwarder?.companyName ||
                  order.assignedFreightForwarder?.name ||
                  "—"}
              </span>
              <span className="truncate text-muted-foreground">
                {order.assignedCustomsAgency?.companyName ||
                  order.assignedCustomsAgency?.name ||
                  "—"}
              </span>
              <span className="font-mono text-muted-foreground">{formatDate(order.createdAt)}</span>
              <span>
                <OrderStatusBadge status={order.status} />
              </span>
              <span className="flex items-center">
                <StaleAlertIcon stale={stale} />
              </span>
            </Link>
          );
        })
      )}
    </div>
  );
}
