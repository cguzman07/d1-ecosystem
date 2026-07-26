import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/session";
import { getOrderById } from "@/features/orders/service";
import { getBookingByOrderId } from "@/features/booking/service";
import { BookingForm } from "@/features/booking/components/booking-form";
import { BookingRevisionHistory } from "@/features/booking/components/booking-revision-history";
import { BookingStatusBadge } from "@/features/booking/components/booking-status-badge";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { Badge } from "@/components/ui/badge";
import {
  docsApprovedFromShipment,
  isBookingActionReady,
} from "@/features/orders/workflow";

type Props = { params: { id: string } };

export default async function OrderBookingPage({ params }: Props) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  const canEdit: Role[] = [
    Role.admin,
    Role.internal_specialist,
    Role.freight_forwarder,
  ];
  if (!canEdit.includes(role)) {
    redirect("/booking?error=forbidden");
  }

  const order = await getOrderById(params.id);
  if (!order) notFound();

  if (role === Role.freight_forwarder && order.freightForwarderId !== session.user.id) {
    redirect("/booking?error=forbidden");
  }

  const booking = await getBookingByOrderId(order.id);
  const shipmentDocsApproved = docsApprovedFromShipment(order.shipment);
  const ready = isBookingActionReady(order.status, shipmentDocsApproved);

  return (
    <div className="space-y-8">
      <div>
        <p className="board-header">
          <Link href="/booking" className="hover:text-primary">
            Booking
          </Link>
          {" / "}
          <Link href={`/orders/${order.id}`} className="hover:text-primary">
            {order.orderNumber}
          </Link>
        </p>
        <h1 className="font-display text-3xl font-bold text-foreground">
          Booking · {order.orderNumber}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <OrderStatusBadge status={order.status} />
          <BookingStatusBadge status={booking?.status ?? "no_booking"} />
          {ready ? (
            <Badge variant="ok">Listo para booking</Badge>
          ) : (
            <Badge variant="warn">En espera de fase anterior</Badge>
          )}
          <span className="text-sm text-muted-foreground">{order.supplier.name}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="board-panel p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
            Registrar / actualizar booking
          </h2>
          <BookingForm
            orderId={order.id}
            readOnly={!ready}
            initial={
              booking
                ? {
                    departureDate: booking.departureDate,
                    arrivalDate: booking.arrivalDate,
                    containerNumbers: booking.containerNumbers,
                    carrier: booking.carrier,
                    status: booking.status,
                  }
                : null
            }
          />
        </div>

        <div className="board-panel p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
            Historial de roleo
          </h2>
          <BookingRevisionHistory revisions={booking?.revisions ?? []} />
        </div>
      </div>
    </div>
  );
}
