import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { CheckCircle2 } from "lucide-react";
import { getSession } from "@/lib/session";
import { getOrderById } from "@/features/orders/service";
import { getCustomsByOrderId } from "@/features/customs/service";
import { CustomsForm } from "@/features/customs/components/customs-form";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { InspectionStatusBadge } from "@/features/customs/components/inspection-status-badge";
import { formatDate } from "@/lib/utils";

type Props = { params: { id: string } };

export default async function OrderCustomsPage({ params }: Props) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  const allowed: Role[] = [
    Role.admin,
    Role.internal_specialist,
    Role.customs_agency,
  ];
  if (!allowed.includes(role)) redirect("/customs?error=forbidden");

  const order = await getOrderById(params.id);
  if (!order) notFound();

  if (role === Role.customs_agency && order.customsAgencyId !== session.user.id) {
    redirect("/customs?error=forbidden");
  }

  const customs = await getCustomsByOrderId(order.id);
  const cleared = order.status === "customs_cleared" || !!customs?.releaseDate;
  const { isCustomsActionReady } = await import("@/features/orders/workflow");
  const ready = isCustomsActionReady(order.status);
  const formLocked = cleared || !ready;

  return (
    <div className="space-y-8">
      <div>
        <p className="board-header">
          <Link href="/customs" className="hover:text-primary">
            Aduana
          </Link>
          {" / "}
          <Link href={`/orders/${order.id}`} className="hover:text-primary">
            {order.orderNumber}
          </Link>
        </p>
        <h1 className="font-display text-3xl font-bold text-foreground">
          Aduana · {order.orderNumber}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <OrderStatusBadge status={order.status} />
          {customs && (
            <InspectionStatusBadge status={customs.inspectionStatus} />
          )}
          {!ready && !cleared && (
            <span className="rounded-sm border border-transparent bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
              En espera de fase anterior
            </span>
          )}
          <span className="text-sm text-muted-foreground">{order.supplier.name}</span>
        </div>
      </div>

      {cleared && (
        <div className="flex items-center gap-3 rounded-md border border-board-ok/30 bg-board-ok/10 px-4 py-3 text-sm text-board-ok">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Orden con levante</p>
            <p className="text-board-ok/80">
              Fecha de levante: {formatDate(customs?.releaseDate)} · Lista para costeo
            </p>
          </div>
        </div>
      )}

      {!ready && !cleared && (
        <div className="rounded-md border border-border bg-muted/80 px-4 py-3 text-sm text-foreground">
          En espera de fase anterior — el caso debe estar embarcado (`shipped`) para registrar
          aduana o levante.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="board-panel p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
            Expediente aduanero
          </h2>
          <CustomsForm
            orderId={order.id}
            readOnly={formLocked}
            initial={
              customs
                ? {
                    declarationNumber: customs.declarationNumber,
                    presentationDate: customs.presentationDate,
                    levanteDate: customs.releaseDate,
                    inspectionStatus: customs.inspectionStatus,
                    inspectionCompletionDate: customs.inspectionCompletedAt,
                    notes: customs.notes,
                  }
                : null
            }
          />
        </div>

        <div className="board-panel space-y-4 p-6">
          <h2 className="font-display text-lg font-semibold text-foreground">Resumen</h2>
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Agencia</dt>
              <dd className="text-foreground">
                {order.assignedCustomsAgency?.companyName ||
                  order.assignedCustomsAgency?.name ||
                  "Sin asignar"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Declaración</dt>
              <dd className="font-mono text-foreground">
                {customs?.declarationNumber || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Presentación</dt>
              <dd className="font-mono text-foreground">
                {formatDate(customs?.presentationDate)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Levante</dt>
              <dd className="font-mono text-foreground">
                {formatDate(customs?.releaseDate)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Inspección</dt>
              <dd className="mt-1">
                {customs ? (
                  <InspectionStatusBadge status={customs.inspectionStatus} />
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
