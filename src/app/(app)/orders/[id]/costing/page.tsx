import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/session";
import { getOrderById } from "@/features/orders/service";
import { getCostingByOrderId } from "@/features/costing/service";
import { CostingForm } from "@/features/costing/components/costing-form";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { formatDate } from "@/lib/utils";

type Props = { params: { id: string } };

export default async function OrderCostingPage({ params }: Props) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  if (role !== Role.admin && role !== Role.internal_specialist) {
    redirect("/?error=forbidden");
  }

  const order = await getOrderById(params.id);
  if (!order) notFound();

  const costing = await getCostingByOrderId(order.id);
  const ready =
    order.status === "customs_cleared" ||
    order.status === "costed" ||
    order.status === "closed" ||
    !!costing;

  return (
    <div className="space-y-8">
      <div>
        <p className="board-header">
          <Link href="/costing" className="hover:text-primary">
            Costeo
          </Link>
          {" / "}
          <Link href={`/orders/${order.id}`} className="hover:text-primary">
            {order.orderNumber}
          </Link>
        </p>
        <h1 className="font-display text-3xl font-bold text-foreground">
          Costeo · {order.orderNumber}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <OrderStatusBadge status={order.status} />
          <span className="text-sm text-muted-foreground">{order.supplier.name}</span>
        </div>
      </div>

      {!ready && (
        <div className="board-panel px-4 py-3 text-sm text-foreground">
          La orden aún no está en levante. Completa aduana antes de
          costear.
        </div>
      )}

      {costing?.closed && (
        <div className="board-panel space-y-1 px-4 py-3 text-sm text-board-ok">
          <p className="font-medium">Costeo finalizado y orden cerrada</p>
          <p className="text-board-ok/80">
            Calculado el {formatDate(costing.calculatedAt)}
            {costing.calculatedBy ? ` por ${costing.calculatedBy.name}` : ""}
          </p>
        </div>
      )}

      <div className="board-panel p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
          Líneas de costo aterrizado
        </h2>
        {ready ? (
          <CostingForm
            orderId={order.id}
            currency={costing?.currency ?? "USD"}
            notes={costing?.notes}
            closed={!!costing?.closed}
            initialLines={
              costing?.lineItems.map((item) => ({
                id: item.id,
                category: item.category,
                description: item.description,
                amount: item.amount.toString(),
                currency: item.currency,
              })) ?? []
            }
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            El formulario se habilitará cuando la orden alcance customs_cleared.
          </p>
        )}
      </div>
    </div>
  );
}
