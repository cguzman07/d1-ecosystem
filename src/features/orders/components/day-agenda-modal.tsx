"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import type { CalendarCaseEvent } from "@/features/orders/calendar-map";
import { cn } from "@/lib/utils";

type Props = {
  dateIso: string | null;
  events: CalendarCaseEvent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectEvent: (event: CalendarCaseEvent) => void;
};

const MILESTONE_LABEL: Record<string, string> = {
  ZARPE: "Zarpe",
  ARRIBO: "Arribo",
  LEVANTE: "Levante",
  CREADA: "Orden creada",
};

function formatDayTitle(dateIso: string): string {
  const d = new Date(`${dateIso}T12:00:00`);
  return d.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function DayAgendaModal({
  dateIso,
  events,
  open,
  onOpenChange,
  onSelectEvent,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        {dateIso && (
          <>
            <div className="border-b border-border bg-gradient-to-br from-primary/[0.07] via-card to-secondary/25 px-6 pb-4 pt-6">
              <DialogHeader className="space-y-1.5 pr-6">
                <DialogTitle className="font-display text-xl font-bold capitalize tracking-tight">
                  {formatDayTitle(dateIso)}
                </DialogTitle>
                <DialogDescription>
                  {events.length === 0
                    ? "No hay casos este día"
                    : `${events.length} caso${events.length === 1 ? "" : "s"} · elige uno para abrir su tarjeta`}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="max-h-[min(60vh,420px)] overflow-y-auto px-3 py-3">
              {events.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Sin movimientos programados.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {events.map((ev) => {
                    const p = ev.extendedProps;
                    return (
                      <li key={ev.id}>
                        <button
                          type="button"
                          onClick={() => onSelectEvent(ev)}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition-colors",
                            "hover:border-border hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                          )}
                        >
                          <span
                            className="mt-1 h-3 w-3 shrink-0 rounded-full shadow-sm"
                            style={{ backgroundColor: ev.backgroundColor }}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1 space-y-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-sm font-bold text-primary">
                                {p.orderNumber}
                              </span>
                              <span
                                className="rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
                                style={{
                                  backgroundColor: ev.backgroundColor,
                                  color: ev.textColor,
                                }}
                              >
                                {MILESTONE_LABEL[p.milestone] ?? p.milestone}
                              </span>
                            </span>
                            <span className="block truncate text-sm text-foreground">
                              {p.supplierName}
                            </span>
                            <OrderStatusBadge status={p.status} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
