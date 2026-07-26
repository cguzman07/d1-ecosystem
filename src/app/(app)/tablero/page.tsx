import Link from "next/link";
import { Role } from "@prisma/client";
import { Plus } from "lucide-react";
import { getSession } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { DashboardBoard } from "@/features/orders/components/dashboard-board";
import {
  mapOrdersToBoardGanttRows,
  mapOrdersToCalendarEvents,
} from "@/features/orders/calendar-map";
import {
  getCalendarOrders,
  getSupplierIdForUser,
  scopeFiltersForRole,
} from "@/features/orders/service";
import type { OrderStatus } from "@prisma/client";

type SearchParams = {
  q?: string;
  status?: string;
  error?: string;
};

export default async function FlightBoardPage({
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

  const status = searchParams.status as OrderStatus | undefined;

  const filters = scopeFiltersForRole(
    session.user.role as Role,
    session.user.id,
    {
      search: searchParams.q,
      status: status || undefined,
      excludeClosed: false,
      page: 1,
      pageSize: 300,
    },
    { supplierIdLinkedToUser: supplierIdLinked },
  );

  const orders = await getCalendarOrders(filters);
  const events = mapOrdersToCalendarEvents(orders);
  const ganttRows = mapOrdersToBoardGanttRows(orders);
  const canCreate =
    session.user.role === "admin" || session.user.role === "internal_specialist";

  const milestoneCounts = {
    creada: events.filter((e) => e.extendedProps.milestone === "CREADA").length,
    zarpe: events.filter((e) => e.extendedProps.milestone === "ZARPE").length,
    arribo: events.filter((e) => e.extendedProps.milestone === "ARRIBO").length,
    levante: events.filter((e) => e.extendedProps.milestone === "LEVANTE").length,
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/80 px-5 py-6 shadow-soft backdrop-blur-xl transition-all duration-300 ease-in-out sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#E30613] via-[#ff4d57] to-[#E30613]" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-secondary/35 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-10 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="board-header mb-2">Operaciones · Vista ejecutiva</p>
            <h1 className="font-display text-2xl font-bold tracking-[-0.03em] text-foreground sm:text-4xl">
              Tablero de casos
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Calendario o Gantt de casos activos — cada orden se postea sola según fechas
              sensitivas.{" "}
              <span className="font-medium text-foreground">{orders.length} órdenes cargadas</span>
              {" · "}
              <span className="text-primary">{ROLE_LABELS[session.user.role]}</span>
            </p>
          </div>
          {canCreate && (
            <Button asChild className="rounded-full shadow-soft">
              <Link href="/orders/new">
                <Plus className="h-4 w-4" />
                Nueva orden
              </Link>
            </Button>
          )}
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <StatChip label="Creadas" value={milestoneCounts.creada} tone="red" />
          <StatChip label="Zarpes" value={milestoneCounts.zarpe} tone="yellow" />
          <StatChip label="Arribos" value={milestoneCounts.arribo} tone="yellow" />
          <StatChip label="Levantes" value={milestoneCounts.levante} tone="green" />
        </div>
      </section>

      {searchParams.error === "forbidden" && (
        <div className="rounded-xl border border-secondary bg-secondary/40 px-4 py-3 text-sm text-amber-900">
          No tienes permiso para acceder a esa sección.
        </div>
      )}

      <DashboardBoard events={events} ganttRows={ganttRows} />
    </div>
  );
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "yellow" | "green";
}) {
  const tones = {
    red: "border-primary/20 bg-primary/[0.06] text-primary",
    yellow: "border-secondary/60 bg-secondary/30 text-foreground",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 shadow-soft backdrop-blur-sm transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-lift ${tones[tone]}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold leading-none tracking-[-0.02em] tabular-nums">
        {value}
      </p>
    </div>
  );
}
