"use client";

import { useMemo, useState } from "react";
import { Gantt, ViewMode, type Task } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import { OrderStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { ORDER_STATUS_LABELS } from "@/lib/rbac";
import { ORDER_STATUS_PALETTE } from "@/features/orders/status-palette";
import type { BoardGanttRow } from "@/features/orders/calendar-map";
import { cn } from "@/lib/utils";

type Props = {
  rows: BoardGanttRow[];
};

function parseDay(iso: string): Date {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12, 0, 0, 0);
}

function ensureRange(start: Date, end: Date): { start: Date; end: Date } {
  if (end.getTime() > start.getTime()) return { start, end };
  const next = new Date(start);
  next.setDate(next.getDate() + 1);
  return { start, end: next };
}

function progressForStatus(status: OrderStatus): number {
  const map: Record<OrderStatus, number> = {
    [OrderStatus.created]: 10,
    [OrderStatus.booking_pending]: 20,
    [OrderStatus.booked]: 35,
    [OrderStatus.shipped]: 50,
    [OrderStatus.customs_in_process]: 65,
    [OrderStatus.customs_cleared]: 80,
    [OrderStatus.costed]: 90,
    [OrderStatus.closed]: 100,
  };
  return map[status] ?? 15;
}

/** End of the case bar: prefer latest known milestone, else today / close date */
function resolveEnd(row: BoardGanttRow, today: Date): Date {
  if (row.status === OrderStatus.closed || row.costingClosed) {
    return parseDay(row.costingCalculatedAt ?? row.updatedAt);
  }
  const candidates = [
    row.costingCalculatedAt,
    row.levanteDate,
    row.arrivalDate,
    row.departureDate,
  ].filter(Boolean) as string[];
  if (candidates.length === 0) return today;
  const latest = candidates
    .map(parseDay)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  // Open cases: stretch to today if still in progress past last milestone
  return latest.getTime() > today.getTime() ? latest : today;
}

function rowsToTasks(rows: BoardGanttRow[]): Task[] {
  const today = startOfToday();
  return rows.map((row, index) => {
    const palette = ORDER_STATUS_PALETTE[row.status];
    const start = parseDay(row.createdAt);
    const range = ensureRange(start, resolveEnd(row, today));
    const label = ORDER_STATUS_LABELS[row.status] ?? row.status;

    return {
      id: row.orderId,
      name: `${row.orderNumber} · ${row.supplierName}`,
      type: "task" as const,
      start: range.start,
      end: range.end,
      progress: progressForStatus(row.status),
      isDisabled: true,
      displayOrder: index + 1,
      styles: {
        backgroundColor: palette.backgroundColor,
        backgroundSelectedColor: palette.borderColor,
        progressColor: palette.borderColor,
        progressSelectedColor: palette.borderColor,
      },
      // Keep status in name tooltip via styles only; table shows name
      project: label,
    };
  });
}

function columnWidthFor(mode: ViewMode): number {
  switch (mode) {
    case ViewMode.Day:
      return 44;
    case ViewMode.Week:
      return 100;
    case ViewMode.Month:
    default:
      return 140;
  }
}

function formatEsDate(date: Date): string {
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Dashboard Gantt: one bar per active case (status-colored).
 */
export function OrdersBoardGantt({ rows }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Month);
  const tasks = useMemo(() => rowsToTasks(rows), [rows]);

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-border/80 bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
        No hay casos activos con los filtros actuales para mostrar en el Gantt.
      </div>
    );
  }

  const chartHeight = Math.min(520, Math.max(180, tasks.length * 48 + 24));

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
      <div className="border-b border-border/70 bg-gradient-to-r from-white via-white to-primary/[0.04] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-sm font-semibold text-foreground">
              Vista Gantt · casos activos
            </p>
            <p className="text-xs text-muted-foreground">
              Una barra por caso · color = estado operativo · {tasks.length} en vista
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { mode: ViewMode.Day, label: "Día" },
                { mode: ViewMode.Week, label: "Semana" },
                { mode: ViewMode.Month, label: "Mes" },
              ] as const
            ).map(({ mode, label }) => (
              <Button
                key={mode}
                type="button"
                size="sm"
                variant={viewMode === mode ? "default" : "outline"}
                className={cn(viewMode === mode && "shadow-sm")}
                onClick={() => setViewMode(mode)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto p-3 sm:p-4">
        <div className="min-w-[720px]">
          <Gantt
            tasks={tasks}
            viewMode={viewMode}
            locale="es"
            columnWidth={columnWidthFor(viewMode)}
            listCellWidth="220px"
            rowHeight={44}
            ganttHeight={chartHeight}
            barCornerRadius={6}
            barFill={60}
            fontSize="12"
            todayColor="rgba(15, 39, 68, 0.08)"
            TooltipContent={({ task, fontSize, fontFamily }) => (
              <div
                className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg"
                style={{ fontSize, fontFamily }}
              >
                <p className="font-semibold text-foreground">{task.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatEsDate(task.start)} → {formatEsDate(task.end)}
                </p>
                <p className="text-xs text-muted-foreground">Avance: {task.progress}%</p>
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}
