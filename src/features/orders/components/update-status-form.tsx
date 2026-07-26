"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateOrderStatusAction } from "@/features/orders/actions";
import { ORDER_STATUS_LABELS } from "@/lib/rbac";
import { ORDER_STATUS_VALUES } from "@/features/orders/status";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function UpdateStatusForm({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const nextOptions = ORDER_STATUS_VALUES.filter((s) => s !== currentStatus);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("orderId", orderId);

    startTransition(async () => {
      const result = await updateOrderStatusAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="space-y-2">
        <Label htmlFor="newStatus">Cambiar estado</Label>
        <select
          id="newStatus"
          name="newStatus"
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          defaultValue=""
        >
          <option value="" disabled>
            Seleccionar nuevo estado
          </option>
          {nextOptions.map((status) => (
            <option key={status} value={status}>
              {ORDER_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="note">Nota (opcional)</Label>
        <input
          id="note"
          name="note"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Motivo del cambio…"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Actualizando…" : "Actualizar estado"}
      </Button>
    </form>
  );
}
