"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import esLocale from "@fullcalendar/core/locales/es";
import type { EventClickArg, EventContentArg, EventInput, MoreLinkArg } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import { CaseDetailModal } from "@/features/orders/components/case-detail-modal";
import { DayAgendaModal } from "@/features/orders/components/day-agenda-modal";
import {
  MILESTONE_SHORT,
  type CalendarCaseEvent,
} from "@/features/orders/calendar-map";
import { cn } from "@/lib/utils";
import "@/features/orders/components/orders-calendar.css";

type Props = {
  events: CalendarCaseEvent[];
};

type LayoutMode = {
  isMobile: boolean;
  height: number | "auto";
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

function useSquareCalendarLayout(
  containerRef: React.RefObject<HTMLDivElement | null>,
): LayoutMode {
  const [layout, setLayout] = useState<LayoutMode>({
    isMobile: false,
    height: 860,
  });

  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      if (w < MOBILE_BREAKPOINT) {
        // Altura fija en móvil: "auto" colapsa el listado y parece "vacío"
        setLayout({ isMobile: true, height: Math.max(520, Math.round(w * 1.35)) });
        return;
      }

      const el = containerRef.current;
      const width = el?.clientWidth ?? Math.min(w - 280, 1100);
      const gap = 7;
      const raw = (width - gap * 8) / 7;
      const cellSide = Math.min(124, Math.max(104, Math.floor(raw)));
      const weeks = 6;
      const chrome = 124;
      const height = Math.round(chrome + cellSide * weeks + gap * (weeks + 1));
      setLayout({ isMobile: false, height });
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
  }, [containerRef]);

  return layout;
}

function CaseChipContent({ arg }: { arg: EventContentArg }) {
  const milestone = arg.event.extendedProps.milestone as
    | keyof typeof MILESTONE_SHORT
    | undefined;
  const orderNumber = String(arg.event.extendedProps.orderNumber ?? arg.event.title);
  const short = milestone ? MILESTONE_SHORT[milestone] : "";
  const textColor = String(arg.event.textColor || "#FFFFFF");
  const isList = arg.view.type.startsWith("list");

  if (isList) {
    return (
      <div className="fc-d1-chip fc-d1-chip--list" style={{ color: "inherit" }}>
        <span className="fc-d1-chip-code">{orderNumber}</span>
        {short ? (
          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
            {short}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="fc-d1-chip" style={{ color: textColor }}>
      <div className="fc-d1-chip-top">
        <span className="fc-d1-chip-code">{orderNumber}</span>
        {short ? <span className="fc-d1-chip-ms">{short}</span> : null}
      </div>
    </div>
  );
}

export function OrdersCalendar({ events }: Props) {
  const calendarRef = useRef<FullCalendar>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<CalendarCaseEvent | null>(null);
  const [caseOpen, setCaseOpen] = useState(false);
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [dayOpen, setDayOpen] = useState(false);
  const { isMobile, height } = useSquareCalendarLayout(containerRef);

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

  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    const target = isMobile ? "listWeek" : "dayGridMonth";
    if (api.view.type !== target) {
      api.changeView(target);
    }
    // Doble update: el layout móvil necesita un segundo tick tras cambiar vista
    api.updateSize();
    const t = window.setTimeout(() => api.updateSize(), 60);
    return () => window.clearTimeout(t);
  }, [isMobile, height]);

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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-display text-base font-semibold tracking-[-0.02em] text-foreground sm:text-lg">
              Calendario de casos
            </p>
            <p className="text-xs text-muted-foreground">
              {isMobile
                ? "Vista lista en móvil · toca un caso para abrir su tarjeta"
                : "Clic en el caso o en el día para ver el detalle"}
            </p>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className={cn(
          "d1-calendar w-full p-2 sm:p-3 lg:p-4",
          isMobile ? "d1-calendar--mobile" : "d1-calendar--desktop",
        )}
      >
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin, listPlugin]}
          initialView={isMobile ? "listWeek" : "dayGridMonth"}
          locale={esLocale}
          headerToolbar={
            isMobile
              ? {
                  left: "prev,next",
                  center: "title",
                  right: "today",
                }
              : {
                  left: "prev,next today",
                  center: "title",
                  right: "dayGridMonth,listWeek",
                }
          }
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
          contentHeight={isMobile ? height : undefined}
          expandRows={false}
          fixedWeekCount={!isMobile}
          stickyHeaderDates={false}
          handleWindowResize
          events={fcEvents}
          eventContent={(arg) => <CaseChipContent arg={arg} />}
          eventClick={onEventClick}
          dateClick={isMobile ? undefined : onDateClick}
          eventDisplay="block"
          dayMaxEvents={isMobile ? true : VISIBLE_EVENTS_PER_DAY}
          moreLinkClick={onMoreLinkClick}
          moreLinkText={(n) => `+${n} casos`}
          eventOrder="start,title"
          noEventsText="No hay casos en este período"
          nowIndicator={false}
        />
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
