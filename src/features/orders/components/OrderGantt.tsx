"use client";

import { useMemo, useState } from "react";
import { Gantt, ViewMode, type Task } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import "@/features/orders/components/order-gantt.css";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Serializable dates for the order lifecycle Gantt (ISO strings from the server). */
export type OrderGanttDates = {
  orderStatus: string;
  createdAt: string;
  updatedAt: string;
  departureDate: string | null;
  arrivalDate: string | null;
  presentationDate: string | null;
  levanteDate: string | null;
  costingCalculatedAt: string | null;
  costingClosed: boolean;
};

type Props = {
  dates: OrderGanttDates;
};

const PHASE = {
  booking: {
    backgroundColor: "#E30613",
    backgroundSelectedColor: "#C10510",
    progressColor: "#FF8A90",
    progressSelectedColor: "#FFB0B5",
  },
  transit: {
    backgroundColor: "#FFF200",
    backgroundSelectedColor: "#E6DB00",
    progressColor: "#C4BC00",
    progressSelectedColor: "#A89F00",
  },
  customs: {
    backgroundColor: "#F59E0B",
    backgroundSelectedColor: "#D97706",
    progressColor: "#FCD34D",
    progressSelectedColor: "#FDE68A",
  },
  costing: {
    backgroundColor: "#16A34A",
    backgroundSelectedColor: "#15803D",
    progressColor: "#86EFAC",
    progressSelectedColor: "#BBF7D0",
  },
} as const;

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

function buildLifecycleTasks(dates: OrderGanttDates): Task[] {
  const today = startOfToday();
  const created = parseDay(dates.createdAt);
  const departure = dates.departureDate ? parseDay(dates.departureDate) : null;
  const arrival = dates.arrivalDate ? parseDay(dates.arrivalDate) : null;
  const presentation = dates.presentationDate
    ? parseDay(dates.presentationDate)
    : null;
  const levante = dates.levanteDate ? parseDay(dates.levanteDate) : null;
  const costingAt = dates.costingCalculatedAt
    ? parseDay(dates.costingCalculatedAt)
    : null;
  const updated = parseDay(dates.updatedAt);
  const isClosed = dates.orderStatus === "closed" || dates.costingClosed;

  const tasks: Task[] = [];

  {
    const end = departure ?? today;
    const range = ensureRange(created, end);
    tasks.push({
      id: "phase-booking",
      name: "Creación y Booking",
      type: "task",
      start: range.start,
      end: range.end,
      progress: departure ? 100 : 55,
      isDisabled: true,
      displayOrder: 1,
      styles: { ...PHASE.booking },
    });
  }

  if (departure) {
    const end = arrival ?? today;
    const range = ensureRange(departure, end);
    tasks.push({
      id: "phase-transit",
      name: "Tránsito Internacional",
      type: "task",
      start: range.start,
      end: range.end,
      progress: arrival ? 100 : 40,
      isDisabled: true,
      displayOrder: 2,
      styles: { ...PHASE.transit },
      dependencies: ["phase-booking"],
    });
  }

  const customsStart = arrival ?? presentation;
  if (customsStart) {
    const end = levante ?? today;
    const range = ensureRange(customsStart, end);
    tasks.push({
      id: "phase-customs",
      name: "Proceso de Aduana",
      type: "task",
      start: range.start,
      end: range.end,
      progress: levante ? 100 : 45,
      isDisabled: true,
      displayOrder: 3,
      styles: { ...PHASE.customs },
      dependencies: departure ? ["phase-transit"] : ["phase-booking"],
    });
  }

  if (levante) {
    const end = costingAt ?? (isClosed ? updated : today);
    const range = ensureRange(levante, end);
    tasks.push({
      id: "phase-costing",
      name: "Costeo y Cierre",
      type: "task",
      start: range.start,
      end: range.end,
      progress: costingAt || isClosed ? 100 : 35,
      isDisabled: true,
      displayOrder: 4,
      styles: { ...PHASE.costing },
      dependencies: ["phase-customs"],
    });
  }

  return tasks;
}

function columnWidthFor(mode: ViewMode): number {
  switch (mode) {
    case ViewMode.Day:
      return 48;
    case ViewMode.Week:
      return 120;
    case ViewMode.Month:
    default:
      return 160;
  }
}

function formatEsDate(date: Date): string {
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const DISPLAY_FONT = "var(--font-space-grotesk), system-ui, sans-serif";

function SpanishTaskListHeader({
  headerHeight,
  rowWidth,
  fontSize,
}: {
  headerHeight: number;
  rowWidth: string;
  fontFamily: string;
  fontSize: string;
}) {
  return (
    <div
      className="border-b border-gray-100 bg-white/60"
      style={{
        height: headerHeight,
        fontFamily: DISPLAY_FONT,
        fontSize,
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{ minWidth: rowWidth, maxWidth: rowWidth }}
        className="px-3 font-medium tracking-[-0.01em] text-muted-foreground"
      >
        Fase
      </div>
      <div className="hidden w-28 shrink-0 px-2 font-medium text-muted-foreground sm:block">
        Inicio
      </div>
      <div className="hidden w-28 shrink-0 px-2 font-medium text-muted-foreground md:block">
        Fin
      </div>
    </div>
  );
}

function SpanishTaskListTable({
  rowHeight,
  rowWidth,
  tasks,
  fontSize,
}: {
  rowHeight: number;
  rowWidth: string;
  fontFamily: string;
  fontSize: string;
  locale: string;
  tasks: Task[];
  selectedTaskId: string;
  setSelectedTask: (taskId: string) => void;
  onExpanderClick: (task: Task) => void;
}) {
  return (
    <div style={{ fontFamily: DISPLAY_FONT, fontSize }}>
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex items-center border-b border-gray-100 text-sm transition-colors duration-300 hover:bg-white/70"
          style={{ height: rowHeight }}
        >
          <div
            style={{ minWidth: rowWidth, maxWidth: rowWidth }}
            className="task-list-name truncate px-3 font-medium tracking-[-0.01em] text-foreground"
            title={task.name}
          >
            {task.name}
          </div>
          <div className="hidden w-28 shrink-0 px-2 font-sans text-xs text-muted-foreground sm:block">
            {formatEsDate(task.start)}
          </div>
          <div className="hidden w-28 shrink-0 px-2 font-sans text-xs text-muted-foreground md:block">
            {formatEsDate(task.end)}
          </div>
        </div>
      ))}
    </div>
  );
}

function SpanishTooltip({
  task,
  fontSize,
}: {
  task: Task;
  fontSize: string;
  fontFamily: string;
}) {
  return (
    <div
      className="rounded-2xl border border-white/60 bg-white/95 px-3 py-2 text-card-foreground shadow-[0_8px_30px_rgb(0,0,0,0.08)] backdrop-blur-xl"
      style={{ fontSize, fontFamily: DISPLAY_FONT }}
    >
      <p className="font-medium tracking-[-0.01em]">{task.name}</p>
      <p className="mt-1 font-sans text-xs text-muted-foreground">
        {formatEsDate(task.start)} → {formatEsDate(task.end)}
      </p>
      <p className="mt-0.5 font-sans text-xs text-muted-foreground">
        Avance: {task.progress}%
      </p>
    </div>
  );
}

/**
 * Lifecycle Gantt for a single case/order.
 * Missing dates are handled gracefully (omit phase or extend to today).
 */
export function OrderGantt({ dates }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Month);
  const tasks = useMemo(() => buildLifecycleTasks(dates), [dates]);

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay fechas suficientes para dibujar la línea de tiempo del proceso.
      </p>
    );
  }

  return (
    <div className="d1-gantt space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
              className={cn(
                "rounded-full",
                viewMode === mode && "shadow-soft",
              )}
              onClick={() => setViewMode(mode)}
            >
              {label}
            </Button>
          ))}
        </div>
        <ul className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide">
          <LegendDot color="#E30613" label="Booking" />
          <LegendDot color="#FFF200" text="#0A0A0A" label="Tránsito" />
          <LegendDot color="#F59E0B" label="Aduana" />
          <LegendDot color="#16A34A" label="Costeo" />
        </ul>
      </div>

      <div className="gantt-premium-wrap w-full overflow-x-auto border border-gray-100 bg-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-sm">
        <div className="min-w-[640px]">
          <Gantt
            tasks={tasks}
            viewMode={viewMode}
            locale="es"
            columnWidth={columnWidthFor(viewMode)}
            listCellWidth="180px"
            rowHeight={48}
            barCornerRadius={8}
            barFill={70}
            fontFamily={DISPLAY_FONT}
            fontSize="13"
            todayColor="rgba(227, 6, 19, 0.1)"
            TooltipContent={SpanishTooltip}
            TaskListHeader={SpanishTaskListHeader}
            TaskListTable={SpanishTaskListTable}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Las fases sin fecha de cierre se proyectan hasta hoy. El tránsito solo aparece cuando hay
        zarpe (SARPE).
      </p>
    </div>
  );
}

function LegendDot({
  color,
  label,
  text = "#fff",
}: {
  color: string;
  label: string;
  text?: string;
}) {
  return (
    <li
      className="inline-flex items-center rounded-full px-2.5 py-1 shadow-soft transition-all duration-300"
      style={{ backgroundColor: color, color: text }}
    >
      {label}
    </li>
  );
}
