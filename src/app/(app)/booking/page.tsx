import { Suspense } from "react";
import { BookingStatus, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { BookingBoard } from "@/features/booking/components/booking-board";
import { getBookingBoard } from "@/features/booking/service";
import { BOOKING_STATUS_LABELS, type BookingStatusValue } from "@/features/booking/labels";

type SearchParams = {
  status?: string;
  q?: string;
  error?: string;
};

export default async function BookingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  const allowed: Role[] = [
    Role.admin,
    Role.internal_specialist,
    Role.freight_forwarder,
  ];
  if (!allowed.includes(role)) {
    redirect("/booking?error=forbidden");
  }

  const statusParam = searchParams.status;
  const status =
    statusParam && Object.values(BookingStatus).includes(statusParam as BookingStatus)
      ? (statusParam as BookingStatus)
      : "all";

  // Strict isolation: forwarders never see the global board
  const forwarderId =
    role === Role.freight_forwarder ? session.user.id : undefined;

  const [rows, allForCounts] = await Promise.all([
    getBookingBoard({
      status,
      forwarderId,
      search: searchParams.q,
    }),
    getBookingBoard({ status: "all", forwarderId }),
  ]);

  const counts = {
    no_booking: allForCounts.filter((r) => r.bookingStatus === "no_booking").length,
    with_booking: allForCounts.filter((r) => r.bookingStatus === "with_booking").length,
    shipped: allForCounts.filter((r) => r.bookingStatus === "shipped").length,
  };

  const statusLabel =
    status === "all"
      ? "Todos"
      : BOOKING_STATUS_LABELS[status as BookingStatusValue];

  return (
    <div className="space-y-6">
      {searchParams.error === "forbidden" && (
        <div className="rounded-xl border border-secondary bg-secondary/40 px-4 py-3 text-sm text-amber-900">
          No tienes permiso para acceder a esa sección.
        </div>
      )}
      <div>
        <p className="board-header">Logística</p>
        <h1 className="font-display text-3xl font-bold text-foreground">
          {role === Role.freight_forwarder ? "Mis Bookings Asignados" : "Booking"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {role === Role.freight_forwarder
            ? "Solo las órdenes asignadas a tu agencia de carga"
            : "Órdenes con gestión de booking"}{" "}
          · Filtro: {statusLabel}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ["no_booking", "Sin booking"],
            ["with_booking", "Con booking"],
            ["shipped", "Embarcado"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="board-panel p-4">
            <p className="board-header">{label}</p>
            <p className="mt-2 font-mono text-3xl text-primary">{counts[key]}</p>
          </div>
        ))}
      </div>

      <Suspense fallback={null}>
        <BookingBoard rows={rows} />
      </Suspense>
    </div>
  );
}
