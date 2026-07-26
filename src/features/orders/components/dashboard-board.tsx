"use client";

import { useMemo, useState } from "react";
import { OrderStatus } from "@prisma/client";
import { CalendarDays, ChartGantt, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { OrdersCalendar } from "@/features/orders/components/orders-calendar";
import { OrdersBoardGantt } from "@/features/orders/components/orders-board-gantt";
import type {
  BoardGanttRow,
  CalendarCaseEvent,
} from "@/features/orders/calendar-map";
import {
  ALL_ORDER_STATUSES,
  DEFAULT_DASHBOARD_STATUSES,
  ORDER_STATUS_PALETTE,
} from "@/features/orders/status-palette";
import { ORDER_STATUS_LABELS } from "@/lib/rbac";
import { cn } from "@/lib/utils";

type BoardView = "calendar" | "gantt";

type Props = {
  events: CalendarCaseEvent[];
  ganttRows: BoardGanttRow[];
};

export function DashboardBoard({ events, ganttRows }: Props) {
  const [view, setView] = useState<BoardView>("calendar");
  const [enabledStatuses, setEnabledStatuses] = useState<OrderStatus[]>(
    () => [...DEFAULT_DASHBOARD_STATUSES],
  );

  const statusSet = useMemo(() => new Set(enabledStatuses), [enabledStatuses]);

  const filteredEvents = useMemo(
    () => events.filter((e) => statusSet.has(e.extendedProps.status)),
    [events, statusSet],
  );

  const filteredGanttRows = useMemo(
    () =>
      ganttRows.filter(
        (row) =>
          statusSet.has(row.status) && row.status !== OrderStatus.closed,
      ),
    [ganttRows, statusSet],
  );

  function toggleStatus(status: OrderStatus, checked: boolean) {
    setEnabledStatuses((prev) => {
      if (checked) {
        return prev.includes(status) ? prev : [...prev, status];
      }
      return prev.filter((s) => s !== status);
    });
  }

  function selectActiveOnly() {
    setEnabledStatuses([...DEFAULT_DASHBOARD_STATUSES]);
  }

  function selectAll() {
    setEnabledStatuses([...ALL_ORDER_STATUSES]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-white/60 bg-white/80 p-3 shadow-soft backdrop-blur-xl transition-all duration-300 ease-in-out sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={view === "calendar" ? "default" : "outline"}
            className={cn("rounded-full", view === "calendar" && "shadow-soft")}
            onClick={() => setView("calendar")}
          >
            <CalendarDays className="h-4 w-4" />
            Vista Calendario
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "gantt" ? "default" : "outline"}
            className={cn("rounded-full", view === "gantt" && "shadow-soft")}
            onClick={() => setView("gantt")}
          >
            <ChartGantt className="h-4 w-4" />
            Vista Gantt
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" size="sm" variant="outline" className="rounded-full">
                <Filter className="h-4 w-4" />
                Filtros
                <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {enabledStatuses.length}/{ALL_ORDER_STATUSES.length}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 space-y-3">
              <div>
                <p className="font-display text-sm font-semibold">Filtrar por estado</p>
                <p className="text-xs text-muted-foreground">
                  Por defecto se ocultan Costeada y Cerrada.
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={selectActiveOnly}>
                  Solo activas
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={selectAll}>
                  Todas
                </Button>
              </div>
              <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {ALL_ORDER_STATUSES.map((status) => {
                  const swatch = ORDER_STATUS_PALETTE[status];
                  const checked = statusSet.has(status);
                  return (
                    <li key={status} className="flex items-center gap-2.5">
                      <Checkbox
                        id={`filter-${status}`}
                        checked={checked}
                        onCheckedChange={(v) => toggleStatus(status, v === true)}
                      />
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: swatch.backgroundColor }}
                        aria-hidden
                      />
                      <Label
                        htmlFor={`filter-${status}`}
                        className="cursor-pointer text-sm font-medium leading-none"
                      >
                        {ORDER_STATUS_LABELS[status] ?? status}
                      </Label>
                    </li>
                  );
                })}
              </ul>
            </PopoverContent>
          </Popover>
        </div>

        <div className="min-w-0 flex-1 sm:max-w-xl sm:text-right">
          <p className="mb-1.5 font-display text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Leyenda
          </p>
          <div className="flex flex-wrap gap-1.5 sm:justify-end">
            {ALL_ORDER_STATUSES.map((status) => {
              const swatch = ORDER_STATUS_PALETTE[status];
              return (
                <span
                  key={status}
                  className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-soft transition-all duration-300 ease-in-out"
                  style={{
                    backgroundColor: swatch.backgroundColor,
                    color: swatch.textColor,
                    opacity: statusSet.has(status) ? 1 : 0.35,
                  }}
                >
                  {ORDER_STATUS_LABELS[status] ?? status}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {view === "calendar"
          ? `${filteredEvents.length} hitos en calendario`
          : `${filteredGanttRows.length} casos en Gantt`}
        {" · "}
        clic en un caso del calendario abre su tarjeta con documentación
      </p>

      {view === "calendar" ? (
        <OrdersCalendar events={filteredEvents} />
      ) : (
        <OrdersBoardGantt rows={filteredGanttRows} />
      )}
    </div>
  );
}
