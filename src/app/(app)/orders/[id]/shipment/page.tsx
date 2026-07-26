import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/session";
import { getOrderById, getSupplierIdForUser } from "@/features/orders/service";
import {
  ensureShipmentForOrder,
  getShipmentByOrderId,
} from "@/features/shipment/service";
import { ShipmentChecklist } from "@/features/shipment/components/shipment-checklist";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { Button } from "@/components/ui/button";
import { initializeShipmentAction } from "@/features/shipment/actions";
import { InitializeShipmentButton } from "@/features/shipment/components/initialize-shipment-button";

type Props = { params: { id: string } };

export default async function OrderShipmentPage({ params }: Props) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  const allowed: Role[] = [Role.admin, Role.internal_specialist, Role.supplier];
  if (!allowed.includes(role)) redirect("/shipment?error=forbidden");

  const order = await getOrderById(params.id);
  if (!order) notFound();

  if (role === Role.supplier) {
    const supplierId = await getSupplierIdForUser(session.user.id);
    if (!supplierId || order.supplierId !== supplierId) {
      redirect("/shipment?error=forbidden");
    }
  }

  let shipment = await getShipmentByOrderId(order.id);

  // Auto-init for specialists when opening the page
  if (!shipment && (role === Role.admin || role === Role.internal_specialist)) {
    shipment = await ensureShipmentForOrder(order.id);
  }

  const canReview = role === Role.admin || Role.internal_specialist === role;
  const { docsApprovedFromShipment, isShipmentActionReady } = await import(
    "@/features/orders/workflow"
  );
  const docsApproved = docsApprovedFromShipment(shipment);
  const supplierPhaseReady = isShipmentActionReady(order.status, docsApproved);
  const canUpload =
    (role === Role.admin ||
      role === Role.internal_specialist ||
      role === Role.supplier) &&
    (role !== Role.supplier || supplierPhaseReady);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="board-header">
            <Link href="/shipment" className="hover:text-primary">
              Embarque
            </Link>
            {" / "}
            <Link href={`/orders/${order.id}`} className="hover:text-primary">
              {order.orderNumber}
            </Link>
          </p>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Embarque · {order.orderNumber}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <OrderStatusBadge status={order.status} />
            {role === Role.supplier && !supplierPhaseReady && (
              <span className="rounded-sm border border-transparent bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                En espera de fase anterior
              </span>
            )}
            <span className="text-sm text-muted-foreground">{order.supplier.name}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/orders/${order.id}/documents`}>Documentación</Link>
          </Button>
        </div>
      </div>

      {!shipment ? (
        <div className="board-panel space-y-4 p-6">
          <p className="text-sm text-foreground/80">
            Esta orden aún no tiene checklist de embarque.
          </p>
          {canReview && (
            <form
              action={async () => {
                "use server";
                await initializeShipmentAction(order.id);
              }}
            >
              <InitializeShipmentButton />
            </form>
          )}
          {role === Role.supplier && (
            <p className="text-sm text-muted-foreground">
              El especialista interno debe inicializar el checklist antes de que puedas
              cargar documentos.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/60 bg-white/85 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl sm:p-6">
          <h2 className="mb-4 font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
            Documentos requeridos
          </h2>
          <ShipmentChecklist
            orderId={order.id}
            items={shipment.requiredDocuments}
            canUpload={canUpload}
            canReview={canReview}
          />
        </div>
      )}
    </div>
  );
}
