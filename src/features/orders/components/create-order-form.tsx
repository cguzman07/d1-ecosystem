"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createOrderAction } from "@/features/orders/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Option = { id: string; name: string; companyName?: string | null; country?: string };

type Props = {
  suppliers: Option[];
  forwarders: Option[];
  agencies: Option[];
};

export function CreateOrderForm({ suppliers, forwarders, agencies }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createOrderAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/orders/${result.orderId}`);
      router.refresh();
    });
  }

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <form onSubmit={onSubmit} className="board-panel max-w-2xl space-y-5 p-6">
      <div className="space-y-2">
        <Label htmlFor="sapReference">Referencia SAP</Label>
        <Input
          id="sapReference"
          name="sapReference"
          placeholder="Ej. 4500123456"
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="supplierId">Proveedor *</Label>
        <select id="supplierId" name="supplierId" required className={selectClass} defaultValue="">
          <option value="" disabled>
            Seleccionar proveedor
          </option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.country ? ` · ${s.country}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="freightForwarderId">Agente de carga</Label>
        <select
          id="freightForwarderId"
          name="freightForwarderId"
          className={selectClass}
          defaultValue=""
        >
          <option value="">Sin asignar</option>
          {forwarders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.companyName || f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="customsAgencyId">Agencia de aduana</Label>
        <select
          id="customsAgencyId"
          name="customsAgencyId"
          className={selectClass}
          defaultValue=""
        >
          <option value="">Sin asignar</option>
          {agencies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.companyName || a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Observaciones internas…"
        />
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Creando…" : "Crear orden"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => router.push("/orders")}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
