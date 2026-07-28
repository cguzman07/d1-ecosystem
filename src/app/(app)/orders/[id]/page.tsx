import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Role } from "@prisma/client";
import { ArrowLeft, Plus } from "lucide-react";
import { getSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { OrderTimeline } from "@/features/orders/components/order-timeline";
import { OrderGantt } from "@/features/orders/components/OrderGantt";
import { UpdateStatusForm } from "@/features/orders/components/update-status-form";
import { BookingStatusBadge } from "@/features/booking/components/booking-status-badge";
import { ShipmentChecklist } from "@/features/shipment/components/shipment-checklist";
import {
  getOrderById,
  getSupplierIdForUser,
} from "@/features/orders/service";
import { getBookingByOrderId } from "@/features/booking/service";
import {
  ensureShipmentForOrder,
  getShipmentByOrderId,
} from "@/features/shipment/service";
import {
  docsApprovedFromShipment,
  isShipmentActionReady,
} from "@/features/orders/workflow";

type Props = { params: { id: string } };

export default async function OrderDetailPage({ params }: Props) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const order = await getOrderById(params.id);
  if (!order) notFound();

  const role = session.user.role as Role;

  if (role === Role.freight_forwarder && order.freightForwarderId !== session.user.id) {
    redirect("/booking?error=forbidden");
  }
  if (role === Role.customs_agency && order.customsAgencyId !== session.user.id) {
    redirect("/customs?error=forbidden");
  }
  if (role === Role.supplier) {
    const supplierId = await getSupplierIdForUser(session.user.id);
    if (!supplierId || order.supplierId !== supplierId) {
      redirect("/shipment?error=forbidden");
    }
  }

  const canManage = role === Role.admin || role === Role.internal_specialist;
  const canBooking =
    role === Role.admin ||
    role === Role.internal_specialist ||
    role === Role.freight_forwarder;
  const canShipment =
    role === Role.admin ||
    role === Role.internal_specialist ||
    role === Role.supplier;
  const canCustoms =
    role === Role.admin ||
    role === Role.internal_specialist ||
    role === Role.customs_agency;
  const canCosting = role === Role.admin || role === Role.internal_specialist;
  const canDocuments = true;

  const booking = canBooking ? await getBookingByOrderId(order.id) : order.booking;

  let shipment = await getShipmentByOrderId(order.id);
  if (!shipment && (role === Role.admin || role === Role.internal_specialist)) {
    shipment = await ensureShipmentForOrder(order.id);
  }

  const canReviewDocs = role === Role.admin || role === Role.internal_specialist;
  const docsApproved = docsApprovedFromShipment(shipment);
  const supplierPhaseReady = isShipmentActionReady(order.status, docsApproved);
  const canUploadDocs =
    (role === Role.admin ||
      role === Role.internal_specialist ||
      role === Role.supplier) &&
    (role !== Role.supplier || supplierPhaseReady);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <section className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/80 px-5 py-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl sm:px-7">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#0F2744] via-[#1E3A5F] to-[#2F6F6A]" />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <p className="board-header mb-2">
              <Link
                href="/orders"
                className="inline-flex items-center gap-1 transition-colors hover:text-primary"
              >
                <ArrowLeft className="h-3 w-3" />
                Órdenes
              </Link>
              {" · "}
              {order.orderNumber}
            </p>
            <h1 className="font-display text-3xl font-bold tracking-[-0.03em] text-foreground sm:text-4xl">
              {order.orderNumber}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              <span className="font-medium text-foreground">{order.supplier.name}</span>
              {" · "}
              {order.supplier.country}
              {" · "}
              Creada {formatDate(order.createdAt)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <OrderStatusBadge status={order.status} />
              {booking && <BookingStatusBadge status={booking.status} />}
              {order.sapReference && (
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
                  SAP: {order.sapReference}
                </span>
              )}
              {booking?.departureDate && (
                <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs text-muted-foreground shadow-soft">
                  Zarpe {formatDate(booking.departureDate)}
                </span>
              )}
              {booking?.arrivalDate && (
                <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs text-muted-foreground shadow-soft">
                  Arribo {formatDate(booking.arrivalDate)}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canBooking && (
              <Button asChild variant="outline" className="rounded-full">
                <Link href={`/orders/${order.id}/booking`}>Booking</Link>
              </Button>
            )}
            {canShipment && (
              <Button asChild variant="outline" className="rounded-full">
                <Link href={`/orders/${order.id}/shipment`}>Embarque</Link>
              </Button>
            )}
            {canCustoms && (
              <Button asChild variant="outline" className="rounded-full">
                <Link href={`/orders/${order.id}/customs`}>Aduana</Link>
              </Button>
            )}
            {canCosting && (
              <Button asChild variant="outline" className="rounded-full">
                <Link href={`/orders/${order.id}/costing`}>Costeo</Link>
              </Button>
            )}
            {canDocuments && (
              <Button asChild variant="outline" className="rounded-full">
                <Link href={`/orders/${order.id}/documents`}>Documentos</Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Gantt + Documents */}
      <section className="grid gap-6 lg:grid-cols-[1.55fr_1fr] lg:gap-8">
        <div className="rounded-2xl border border-white/60 bg-white/85 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300 sm:p-6">
          <div className="mb-5">
            <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
              Línea de tiempo del proceso
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Fases del caso, duraciones y traslapes (tránsito, aduana, costeo).
            </p>
          </div>
          <OrderGantt
            dates={{
              orderStatus: order.status,
              createdAt: order.createdAt.toISOString(),
              updatedAt: order.updatedAt.toISOString(),
              departureDate: booking?.departureDate?.toISOString() ?? null,
              arrivalDate: booking?.arrivalDate?.toISOString() ?? null,
              presentationDate: order.customs?.presentationDate?.toISOString() ?? null,
              levanteDate: order.customs?.releaseDate?.toISOString() ?? null,
              costingCalculatedAt: order.costing?.calculatedAt?.toISOString() ?? null,
              costingClosed: order.costing?.closed ?? false,
            }}
          />
        </div>

        <div className="rounded-2xl border border-white/60 bg-white/85 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl transition-all duration-300 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
                Documentos de embarque
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Checklist requerido del caso
              </p>
            </div>
            {canShipment && (
              <Button asChild variant="ghost" size="sm" className="rounded-full shrink-0">
                <Link href={`/orders/${order.id}/shipment`}>
                  <Plus className="h-3.5 w-3.5" />
                  Ver todo
                </Link>
              </Button>
            )}
          </div>

          {!shipment ? (
            <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-muted-foreground">
              Aún no hay checklist de embarque.
              {canReviewDocs && (
                <p className="mt-2">
                  <Link
                    href={`/orders/${order.id}/shipment`}
                    className="font-medium text-primary hover:underline"
                  >
                    Inicializar en Embarque
                  </Link>
                </p>
              )}
            </div>
          ) : (
            <ShipmentChecklist
              orderId={order.id}
              items={shipment.requiredDocuments}
              canUpload={canUploadDocs}
              canReview={canReviewDocs}
              compact
            />
          )}
        </div>
      </section>

      {/* Info + status management */}
      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-8">
        <div className="rounded-2xl border border-white/60 bg-white/85 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl sm:p-6">
          <h2 className="mb-4 font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
            Información principal
          </h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Proveedor
              </dt>
              <dd className="mt-1 font-medium text-foreground">{order.supplier.name}</dd>
              <dd className="text-xs text-muted-foreground">
                {order.supplier.country} ·{" "}
                {order.supplier.type === "international" ? "Internacional" : "Nacional"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Agente de carga
              </dt>
              <dd className="mt-1 font-medium text-foreground">
                {order.assignedFreightForwarder?.companyName ||
                  order.assignedFreightForwarder?.name ||
                  "Sin asignar"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Agencia de aduana
              </dt>
              <dd className="mt-1 font-medium text-foreground">
                {order.assignedCustomsAgency?.companyName ||
                  order.assignedCustomsAgency?.name ||
                  "Sin asignar"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Creada por
              </dt>
              <dd className="mt-1 font-medium text-foreground">{order.createdBy.name}</dd>
              <dd className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Notas
              </dt>
              <dd className="mt-1 text-foreground">{order.notes || "—"}</dd>
            </div>
          </dl>

          {booking && (
            <div className="mt-5 border-t border-gray-100 pt-5">
              <h3 className="mb-3 font-display text-sm font-medium tracking-[-0.01em] text-foreground">
                Booking actual
              </h3>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">SARPE</dt>
                  <dd className="font-medium text-foreground">
                    {formatDate(booking.departureDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Llegada</dt>
                  <dd className="font-medium text-foreground">
                    {formatDate(booking.arrivalDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Naviera</dt>
                  <dd className="text-foreground">{booking.carrier || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Contenedores</dt>
                  <dd className="font-mono text-foreground">
                    {booking.containerNumbers.length
                      ? booking.containerNumbers.join(", ")
                      : "—"}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        {canManage && (
          <div className="rounded-2xl border border-white/60 bg-white/85 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl sm:p-6">
            <h2 className="mb-4 font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
              Gestión de estado
            </h2>
            <UpdateStatusForm orderId={order.id} currentStatus={order.status} />
          </div>
        )}
      </section>

      {/* Timeline history */}
      <section className="rounded-2xl border border-white/60 bg-white/85 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-xl sm:p-6">
        <h2 className="mb-6 font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
          Historial de estados
        </h2>
        <OrderTimeline history={order.statusHistory} />
      </section>
    </div>
  );
}
