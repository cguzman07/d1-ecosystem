"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { BookingStatusBadge } from "@/features/booking/components/booking-status-badge";
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_VALUES,
} from "@/features/booking/labels";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type BoardRow = {
  id: string;
  orderNumber: string;
  sapReference: string | null;
  bookingStatus: string;
  workflowReady?: boolean;
  shipmentDocsApproved?: boolean;
  supplier: { name: string };
  freightForwarder: { name: string; companyName: string | null } | null;
  booking: {
    departureDate: Date | null;
    arrivalDate: Date | null;
    carrier: string | null;
    containerNumbers: string[];
  } | null;
};

export function BookingBoard({ rows }: { rows: BoardRow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `/booking?${qs}` : "/booking"));
  }

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      <div className={`grid gap-3 sm:grid-cols-2 ${pending ? "opacity-70" : ""}`}>
        <Input
          placeholder="Buscar orden o proveedor…"
          defaultValue={searchParams.get("q") ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            window.clearTimeout((window as unknown as { __bkQ?: number }).__bkQ);
            (window as unknown as { __bkQ?: number }).__bkQ = window.setTimeout(
              () => update("q", value),
              350,
            );
          }}
        />
        <select
          className={selectClass}
          defaultValue={searchParams.get("status") ?? "all"}
          onChange={(e) =>
            update("status", e.target.value === "all" ? "" : e.target.value)
          }
          aria-label="Estado booking"
        >
          <option value="all">Todos los estados</option>
          {BOOKING_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {BOOKING_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="board-panel overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-border font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Orden</th>
              <th className="px-4 py-3 font-medium">Proveedor</th>
              <th className="px-4 py-3 font-medium">Estado booking</th>
              <th className="px-4 py-3 font-medium">Pipeline</th>
              <th className="px-4 py-3 font-medium">SARPE</th>
              <th className="px-4 py-3 font-medium">Llegada</th>
              <th className="px-4 py-3 font-medium">Naviera</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  No hay órdenes en este filtro
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const ready = row.workflowReady !== false && row.shipmentDocsApproved !== false;
                return (
                  <tr
                    key={row.id}
                    className="border-b border-border hover:bg-primary/5"
                  >
                    <td className="px-4 py-3 font-mono text-primary">
                      {row.orderNumber}
                    </td>
                    <td className="px-4 py-3 text-foreground">{row.supplier.name}</td>
                    <td className="px-4 py-3">
                      <BookingStatusBadge status={row.bookingStatus} />
                    </td>
                    <td className="px-4 py-3">
                      {ready ? (
                        <Badge variant="ok">Listo para booking</Badge>
                      ) : (
                        <Badge variant="warn">En espera de fase anterior</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {formatDate(row.booking?.departureDate)}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {formatDate(row.booking?.arrivalDate)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.booking?.carrier || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {ready ? (
                        <Link
                          href={`/orders/${row.id}/booking`}
                          className="text-primary hover:underline"
                        >
                          Gestionar
                        </Link>
                      ) : (
                        <span className="cursor-not-allowed text-muted-foreground/60">
                          Gestionar
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
