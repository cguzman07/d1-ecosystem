"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import esLocale from "@fullcalendar/core/locales/es";
import type { EventClickArg, EventContentArg, EventInput, MoreLinkArg } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CaseDetailModal } from "@/features/orders/components/case-detail-modal";
import { DayAgendaModal } from "@/features/orders/components/day-agenda-modal";
import {
  MILESTONE_SHORT,
  type CalendarCaseEvent,
} from "@/features/orders/calendar-map";
import { ORDER_STATUS_LABELS } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import "@/features/orders/components/orders-calendar.css";

type Props = {
  events: CalendarCaseEvent[];
};

const VISIBLE_EVENTS_PER_DAY = 2;
const MOBILE_BREAKPOINT = 768;

function toDateKey(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function eventsForDay(events: CalendarCaseEvent[], dateKey: string) {
  return events.filter((e) => toDateKey(e.start) === dateKey);
}

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  x.setDate(x.getDate() + diff);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatDayHeading(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

function formatWeekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const a = weekStart.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  const b = end.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
  return `${a} – ${b}`;
}

function useIsMobile(): { ready: boolean; isMobile: boolean } {
  const [ready, setReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const apply = () => setIsMobile(mq.matches);
    apply();
    setReady(true);
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return { ready, isMobile };
}

function useDesktopCalendarHeight(
  containerRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
): number {
  const [height, setHeight] = useState(860);

  useEffect(() => {
    if (!enabled) return;

    function update() {
      const el = containerRef.current;
      const w = window.innerWidth;
      const width = el?.clientWidth ?? Math.min(w - 280, 1100);
      const gap = 7;
      const raw = (width - gap * 8) / 7;
      const cellSide = Math.min(124, Math.max(104, Math.floor(raw)));
      const weeks = 6;
      const chrome = 124;
      setHeight(Math.round(chrome + cellSide * weeks + gap * (weeks + 1)));
    }

    update();
    window.addEventListener("resize", update);
    const el = containerRef.current;
    const ro =
      typeof ResizeObserver !== "undefined" && el
        ? new ResizeObserver(() => update())
        : null;
    if (el && ro) ro.observe(el);
    const t = window.setTimeout(update, 80);
    return () => {
      window.removeEventListener("resize", update);
      ro?.disconnect();
      window.clearTimeout(t);
    };
  }, [containerRef, enabled]);

  return height;
}

function CaseChipContent({ arg }: { arg: EventContentArg }) {
  const milestone = arg.event.extendedProps.milestone as
    | keyof typeof MILESTONE_SHORT
    | undefined;
  const orderNumber = String(arg.event.extendedProps.orderNumber ?? arg.event.title);
  const short = milestone ? MILESTONE_SHORT[milestone] : "";
  const textColor = String(arg.event.textColor || "#FFFFFF");

  return (
    <div className="fc-d1-chip" style={{ color: textColor }}>
      <div className="fc-d1-chip-top">
        <span className="fc-d1-chip-code">{orderNumber}</span>
        {short ? <span className="fc-d1-chip-ms">{short}</span> : null}
      </div>
    </div>
  );
}

/** Agenda nativa para móvil — sin FullCalendar (evita celdas colapsadas). */
function MobileCasesAgenda({
  events,
  onSelect,
}: {
  events: CalendarCaseEvent[];
  onSelect: (ev: CalendarCaseEvent) => void;
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(weekStart, i);
      const key = toDateKey(day);
      return { key, day, items: eventsForDay(events, key) };
    });
  }, [events, weekStart]);

  const totalInWeek = weekDays.reduce((n, d) => n + d.items.length, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white px-2 py-2 shadow-sm">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-10 w-10 shrink-0 rounded-full"
          onClick={() => setWeekStart((w) => addDays(w, -7))}
          aria-label="Semana anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 text-center">
          <p className="font-display text-sm font-semibold tracking-tight text-foreground">
            {formatWeekLabel(weekStart)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {totalInWeek} hito{totalInWeek === 1 ? "" : "s"} esta semana
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-10 w-10 shrink-0 rounded-full"
          onClick={() => setWeekStart((w) => addDays(w, 7))}
          aria-label="Semana siguiente"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex justify-center">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-full"
          onClick={() => setWeekStart(startOfWeek(new Date()))}
        >
          Ir a esta semana
        </Button>
      </div>

      <div className="space-y-3">
        {weekDays.map(({ key, items }) => {
          const isToday = key === toDateKey(new Date());
          return (
            <section
              key={key}
              className={cn(
                "overflow-hidden rounded-2xl border bg-white shadow-[0_6px_20px_rgba(15,23,42,0.07)]",
                isToday ? "border-[#E30613]/35 ring-1 ring-[#E30613]/15" : "border-slate-200/90",
              )}
            >
              <header
                className={cn(
                  "flex items-center justify-between px-3.5 py-2.5",
                  isToday ? "bg-gradient-to-r from-secondary/40 to-white" : "bg-slate-50",
                )}
              >
                <p className="font-display text-sm font-semibold capitalize tracking-tight text-foreground">
                  {formatDayHeading(key)}
                </p>
                {isToday && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                    Hoy
                  </span>
                )}
              </header>

              {items.length === 0 ? (
                <p className="px-3.5 py-3 text-xs text-muted-foreground">Sin hitos</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {items.map((ev) => (
                    <li key={ev.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors active:bg-slate-50"
                        onClick={() => onSelect(ev)}
                      >
                        <span
                          className="h-10 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: ev.backgroundColor }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-display text-sm font-semibold tracking-tight text-foreground">
                            {ev.extendedProps.orderNumber}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {ev.extendedProps.supplierName} ·{" "}
                            {ORDER_STATUS_LABELS[ev.extendedProps.status] ??
                              ev.extendedProps.status}
                          </span>
                        </span>
                        <span
                          className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm"
                          style={{
                            backgroundColor: ev.backgroundColor,
                            color: ev.textColor,
                          }}
                        >
                          {MILESTONE_SHORT[ev.extendedProps.milestone]}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DesktopFullCalendar({
  fcEvents,
  height,
  containerRef,
  onEventClick,
  onDateClick,
  onMoreLinkClick,
}: {
  fcEvents: EventInput[];
  height: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onEventClick: (info: EventClickArg) => void;
  onDateClick: (info: DateClickArg) => void;
  onMoreLinkClick: (info: MoreLinkArg) => void;
}) {
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.updateSize();
    const t = window.setTimeout(() => api.updateSize(), 60);
    return () => window.clearTimeout(t);
  }, [height]);

  return (
    <div ref={containerRef} className="d1-calendar d1-calendar--desktop w-full p-2 sm:p-3 lg:p-4">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, interactionPlugin, listPlugin]}
        initialView="dayGridMonth"
        locale={esLocale}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,listWeek",
        }}
        buttonText={{
          today: "Hoy",
          month: "Mes",
          week: "Lista",
          list: "Lista",
        }}
        views={{
          listWeek: { buttonText: "Lista" },
          dayGridMonth: { buttonText: "Mes" },
        }}
        height={height}
        expandRows={false}
        fixedWeekCount
        stickyHeaderDates={false}
        handleWindowResize
        events={fcEvents}
        eventContent={(arg) => <CaseChipContent arg={arg} />}
        eventClick={onEventClick}
        dateClick={onDateClick}
        eventDisplay="block"
        dayMaxEvents={VISIBLE_EVENTS_PER_DAY}
        moreLinkClick={onMoreLinkClick}
        moreLinkText={(n) => `+${n} casos`}
        eventOrder="start,title"
        noEventsText="No hay casos en este período"
        nowIndicator={false}
      />
    </div>
  );
}

export function OrdersCalendar({ events }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { ready, isMobile } = useIsMobile();
  const height = useDesktopCalendarHeight(containerRef, ready && !isMobile);

  const [selected, setSelected] = useState<CalendarCaseEvent | null>(null);
  const [caseOpen, setCaseOpen] = useState(false);
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [dayOpen, setDayOpen] = useState(false);

  const dayEvents = useMemo(
    () => (dayKey ? eventsForDay(events, dayKey) : []),
    [events, dayKey],
  );

  const fcEvents: EventInput[] = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        allDay: true,
        backgroundColor: e.backgroundColor,
        borderColor: e.borderColor,
        textColor: e.textColor,
        classNames: [e.className, "fc-event-milestone"],
        extendedProps: e.extendedProps,
      })),
    [events],
  );

  function openDay(dateKey: string) {
    setDayKey(dateKey);
    setDayOpen(true);
  }

  function openCase(event: CalendarCaseEvent) {
    setSelected(event);
    setCaseOpen(true);
  }

  function onEventClick(info: EventClickArg) {
    info.jsEvent.preventDefault();
    info.jsEvent.stopPropagation();
    const match = events.find((e) => e.id === info.event.id) ?? null;
    if (!match) return;
    openCase(match);
  }

  function onDateClick(info: DateClickArg) {
    openDay(toDateKey(info.date));
  }

  function onMoreLinkClick(info: MoreLinkArg) {
    info.jsEvent.preventDefault();
    openDay(toDateKey(info.date));
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-b from-slate-100/90 via-slate-50 to-slate-100/80 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-300 ease-in-out">
      <div className="border-b border-slate-200/70 bg-gradient-to-r from-white via-white to-secondary/25 px-4 py-3.5 sm:px-5">
        <div>
          <p className="font-display text-base font-semibold tracking-[-0.02em] text-foreground sm:text-lg">
            Calendario de casos
          </p>
          <p className="text-xs text-muted-foreground">
            {!ready
              ? "Cargando vista…"
              : isMobile
                ? "Agenda semanal · toca un caso para abrir su tarjeta"
                : "Clic en el caso o en el día para ver el detalle"}
          </p>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {!ready ? (
          <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 text-sm text-muted-foreground">
            Preparando calendario…
          </div>
        ) : isMobile ? (
          <MobileCasesAgenda events={events} onSelect={openCase} />
        ) : (
          <DesktopFullCalendar
            fcEvents={fcEvents}
            height={height}
            containerRef={containerRef}
            onEventClick={onEventClick}
            onDateClick={onDateClick}
            onMoreLinkClick={onMoreLinkClick}
          />
        )}
      </div>

      <DayAgendaModal
        dateIso={dayKey}
        events={dayEvents}
        open={dayOpen}
        onOpenChange={(next) => {
          setDayOpen(next);
          if (!next) setDayKey(null);
        }}
        onSelectEvent={(ev) => {
          openCase(ev);
        }}
      />

      <CaseDetailModal
        event={selected}
        open={caseOpen}
        onOpenChange={(next) => {
          setCaseOpen(next);
          if (!next) setSelected(null);
        }}
      />
    </div>
  );
}
