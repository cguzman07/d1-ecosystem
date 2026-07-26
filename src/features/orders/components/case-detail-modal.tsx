"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  FileText,
  Ship,
  Users,
} from "lucide-react";
import { DocumentChecklistStatus } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import {
  MILESTONE_SHORT,
  type CalendarCaseEvent,
} from "@/features/orders/calendar-map";
import { cn } from "@/lib/utils";

type Props = {
  event: CalendarCaseEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DOC_STATUS: Record<
  DocumentChecklistStatus,
  { label: string; className: string }
> = {
  [DocumentChecklistStatus.pending]: {
    label: "Pendiente",
    className: "bg-muted text-muted-foreground",
  },
  [DocumentChecklistStatus.submitted]: {
    label: "Enviado",
    className: "bg-secondary/80 text-foreground",
  },
  [DocumentChecklistStatus.needs_correction]: {
    label: "Corregir",
    className: "bg-primary/10 text-primary",
  },
  [DocumentChecklistStatus.approved]: {
    label: "Listo",
    className: "bg-emerald-100 text-emerald-800",
  },
};

function ChecklistRow({ done, label }: { done: boolean; label: string }) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
        done ? "bg-emerald-50" : "bg-muted/50",
      )}
    >
      {done ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
      )}
      <span className={cn("font-medium", done ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
      <span
        className={cn(
          "ml-auto rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
          done ? "bg-emerald-100 text-emerald-800" : "bg-background text-muted-foreground",
        )}
      >
        {done ? "Listo" : "Falta"}
      </span>
    </li>
  );
}

export function CaseDetailModal({ event, open, onOpenChange }: Props) {
  const props = event?.extendedProps;
  const docsApproved = props?.documents.filter(
    (d) => d.status === DocumentChecklistStatus.approved,
  ).length;
  const docsTotal = props?.documents.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,720px)] gap-0 overflow-hidden sm:max-w-lg">
        {props && (
          <>
            <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-primary/[0.08] via-card to-secondary/30 px-6 pb-5 pt-6">
              <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-secondary/50 blur-2xl" />
              <DialogHeader className="relative space-y-3">
                <div className="flex flex-wrap items-center gap-2 pr-8">
                  <p className="board-header">Caso</p>
                  <span
                    className="rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: event.backgroundColor,
                      color: event.textColor,
                    }}
                  >
                    {MILESTONE_SHORT[props.milestone]}
                  </span>
                </div>
                <DialogTitle className="font-mono text-2xl font-bold tracking-tight text-primary">
                  {props.orderNumber}
                </DialogTitle>
                <DialogDescription className="text-base font-medium text-foreground">
                  {props.supplierName}
                </DialogDescription>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <OrderStatusBadge status={props.status} />
                </div>

                {/* Progress */}
                <div className="pt-2">
                  <div className="mb-1.5 flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-muted-foreground">
                      Avance del caso
                    </span>
                    <span className="font-mono font-bold tabular-nums text-foreground">
                      {props.progressPct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                      style={{ width: `${props.progressPct}%` }}
                    />
                  </div>
                </div>
              </DialogHeader>
            </div>

            <div className="max-h-[min(52vh,420px)] space-y-5 overflow-y-auto px-6 py-5">
              <div>
                <p className="board-header mb-3">Progreso operativo</p>
                <ul className="space-y-2">
                  <ChecklistRow done={props.bookingDone} label="Booking registrado" />
                  <ChecklistRow
                    done={props.shipmentDocsApproved}
                    label="Documentos de embarque"
                  />
                  <ChecklistRow done={props.customsCleared} label="Aduana / levante" />
                  <ChecklistRow done={props.costingFinalized} label="Costeo finalizado" />
                </ul>
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-primary" aria-hidden />
                  <p className="board-header mb-0">Documentación del caso</p>
                  {docsTotal > 0 && (
                    <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                      {docsApproved}/{docsTotal}
                    </span>
                  )}
                </div>
                {docsTotal === 0 ? (
                  <p className="rounded-lg bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                    Aún no hay checklist de documentos de embarque.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {props.documents.map((doc) => {
                      const st = DOC_STATUS[doc.status];
                      const done = doc.status === DocumentChecklistStatus.approved;
                      return (
                        <li
                          key={doc.id}
                          className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card px-3 py-2"
                        >
                          {done ? (
                            <CheckCircle2
                              className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                              aria-hidden
                            />
                          ) : (
                            <Circle
                              className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
                              aria-hidden
                            />
                          )}
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {doc.documentType}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide",
                              st.className,
                            )}
                          >
                            {st.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {(props.freightForwarderName ||
                props.customsAgencyName ||
                props.carrier ||
                props.containers.length > 0) && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-primary" aria-hidden />
                    <p className="board-header mb-0">Agentes del caso</p>
                  </div>
                  <div className="grid gap-2 rounded-xl border border-border/70 bg-muted/25 px-3.5 py-3 text-sm">
                    <AgentLine label="Proveedor" value={props.supplierName} />
                    {props.freightForwarderName && (
                      <AgentLine label="Freight forwarder" value={props.freightForwarderName} />
                    )}
                    {props.customsAgencyName && (
                      <AgentLine label="Agencia aduana" value={props.customsAgencyName} />
                    )}
                    {props.carrier && <AgentLine label="Naviera / carrier" value={props.carrier} />}
                    {props.containers.length > 0 && (
                      <AgentLine
                        label="Contenedor(es)"
                        value={props.containers.join(", ")}
                      />
                    )}
                  </div>
                </div>
              )}

              {(props.departureDate || props.arrivalDate || props.levanteDate) && (
                <div className="rounded-xl border border-border/80 bg-muted/30 px-4 py-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Ship className="h-3.5 w-3.5 text-primary" aria-hidden />
                    <p className="board-header mb-0">Fechas sensitivas</p>
                  </div>
                  <div className="grid gap-1.5 font-mono text-xs text-muted-foreground">
                    {props.departureDate && (
                      <p>
                        Zarpe:{" "}
                        <span className="font-semibold text-foreground">
                          {props.departureDate}
                        </span>
                      </p>
                    )}
                    {props.arrivalDate && (
                      <p>
                        Arribo:{" "}
                        <span className="font-semibold text-foreground">
                          {props.arrivalDate}
                        </span>
                      </p>
                    )}
                    {props.levanteDate && (
                      <p>
                        Levante:{" "}
                        <span className="font-semibold text-foreground">
                          {props.levanteDate}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="border-t border-border bg-muted/20 px-6 py-4 sm:justify-stretch">
              <Button asChild className="w-full shadow-sm">
                <Link href={`/orders/${props.orderId}`}>
                  Abrir caso completo
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AgentLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </p>
  );
}
