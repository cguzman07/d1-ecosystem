"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createOrUpdateCustomsAction } from "@/features/customs/actions";
import {
  INSPECTION_STATUS_LABELS,
  INSPECTION_STATUS_VALUES,
} from "@/features/customs/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  orderId: string;
  initial?: {
    declarationNumber?: string | null;
    presentationDate?: Date | string | null;
    levanteDate?: Date | string | null;
    inspectionStatus?: string;
    inspectionCompletionDate?: Date | string | null;
    notes?: string | null;
  } | null;
  readOnly?: boolean;
};

function toDateInput(value?: Date | string | null): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function CustomsForm({ orderId, initial, readOnly }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);
    formData.set("orderId", orderId);

    startTransition(async () => {
      const result = await createOrUpdateCustomsAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Expediente aduanero guardado. Se notificó al equipo interno.");
      router.refresh();
    });
  }

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />

      <div className="space-y-2">
        <Label htmlFor="declarationNumber">Número de declaración</Label>
        <Input
          id="declarationNumber"
          name="declarationNumber"
          placeholder="Ej. DAM-2026-000123"
          defaultValue={initial?.declarationNumber ?? ""}
          disabled={readOnly}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="presentationDate">Fecha de presentación</Label>
          <Input
            id="presentationDate"
            name="presentationDate"
            type="date"
            defaultValue={toDateInput(initial?.presentationDate)}
            disabled={readOnly}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="levanteDate">Fecha de levante</Label>
          <Input
            id="levanteDate"
            name="levanteDate"
            type="date"
            defaultValue={toDateInput(initial?.levanteDate)}
            disabled={readOnly}
          />
          <p className="text-xs text-muted-foreground">
            Al registrar el levante por primera vez, la orden pasa a «Levante».
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="inspectionStatus">Estado de inspección</Label>
          <select
            id="inspectionStatus"
            name="inspectionStatus"
            className={selectClass}
            defaultValue={initial?.inspectionStatus ?? "not_required"}
            disabled={readOnly}
          >
            {INSPECTION_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {INSPECTION_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="inspectionCompletionDate">
            Fecha fin de inspección
          </Label>
          <Input
            id="inspectionCompletionDate"
            name="inspectionCompletionDate"
            type="date"
            defaultValue={toDateInput(initial?.inspectionCompletionDate)}
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          defaultValue={initial?.notes ?? ""}
          disabled={readOnly}
          placeholder="Observaciones del trámite aduanero…"
        />
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      {success && (
        <p className="rounded-md bg-board-ok/10 px-3 py-2 text-sm text-board-ok">
          {success}
        </p>
      )}

      {!readOnly && (
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : initial ? "Actualizar aduana" : "Registrar aduana"}
        </Button>
      )}
    </form>
  );
}
