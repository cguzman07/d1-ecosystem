"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createOrUpdateBookingAction } from "@/features/booking/actions";
import {
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_VALUES,
} from "@/features/booking/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  orderId: string;
  readOnly?: boolean;
  initial?: {
    departureDate?: Date | string | null;
    arrivalDate?: Date | string | null;
    containerNumbers?: string[];
    carrier?: string | null;
    status?: string;
  } | null;
};

function toDateInput(value?: Date | string | null): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function BookingForm({ orderId, initial, readOnly }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (readOnly) return;
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);
    formData.set("orderId", orderId);

    startTransition(async () => {
      const result = await createOrUpdateBookingAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Booking guardado. Se notificó al equipo interno.");
      router.refresh();
    });
  }

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="departureDate">Fecha SARPE (salida)</Label>
          <Input
            id="departureDate"
            name="departureDate"
            type="date"
            defaultValue={toDateInput(initial?.departureDate)}
            disabled={readOnly}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="arrivalDate">Fecha de llegada</Label>
          <Input
            id="arrivalDate"
            name="arrivalDate"
            type="date"
            defaultValue={toDateInput(initial?.arrivalDate)}
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="carrier">Naviera / transportista</Label>
        <Input
          id="carrier"
          name="carrier"
          placeholder="Ej. Maersk, MSC, Hapag-Lloyd"
          defaultValue={initial?.carrier ?? ""}
          disabled={readOnly}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="containerNumbers">Números de contenedor</Label>
        <textarea
          id="containerNumbers"
          name="containerNumbers"
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          placeholder="Uno por línea o separados por coma"
          defaultValue={(initial?.containerNumbers ?? []).join("\n")}
          disabled={readOnly}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Estado de booking</Label>
        <select
          id="status"
          name="status"
          required
          className={selectClass}
          defaultValue={initial?.status ?? "no_booking"}
          disabled={readOnly}
        >
          {BOOKING_STATUS_VALUES.map((status) => (
            <option key={status} value={status}>
              {BOOKING_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      {readOnly && (
        <p className="rounded-md border border-border bg-muted/80 px-3 py-2 text-sm text-foreground">
          En espera de fase anterior — los documentos de embarque deben estar aprobados.
        </p>
      )}

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      {success && (
        <p className="rounded-md bg-board-ok/10 px-3 py-2 text-sm text-board-ok">
          {success}
        </p>
      )}

      <Button type="submit" disabled={pending || readOnly}>
        {pending ? "Guardando…" : initial ? "Actualizar booking" : "Registrar booking"}
      </Button>
    </form>
  );
}
