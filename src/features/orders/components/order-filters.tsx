"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { ORDER_STATUS_LABELS } from "@/lib/rbac";
import { ORDER_STATUS_VALUES } from "@/features/orders/status";

type Props = {
  /** Base path for filter navigation (e.g. "/" or "/orders") */
  basePath: string;
  showDateRange?: boolean;
  showSupplier?: boolean;
  suppliers?: { id: string; name: string }[];
  excludeClosedOption?: boolean;
};

export function OrderFilters({
  basePath,
  showDateRange = false,
  showSupplier = false,
  suppliers = [],
  excludeClosedOption = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      if (key !== "page") params.delete("page");
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${basePath}?${qs}` : basePath);
      });
    },
    [basePath, router, searchParams],
  );

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div
      className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${pending ? "opacity-70" : ""}`}
    >
      <Input
        placeholder="Buscar orden, SAP, proveedor…"
        defaultValue={searchParams.get("q") ?? ""}
        onChange={(e) => {
          const value = e.target.value;
          window.clearTimeout((window as unknown as { __ordQ?: number }).__ordQ);
          (window as unknown as { __ordQ?: number }).__ordQ = window.setTimeout(
            () => update("q", value),
            350,
          );
        }}
      />

      <select
        className={selectClass}
        defaultValue={searchParams.get("status") ?? ""}
        onChange={(e) => update("status", e.target.value)}
        aria-label="Estado"
      >
        <option value="">Todos los estados</option>
        {ORDER_STATUS_VALUES.filter((s) =>
          excludeClosedOption ? s !== "closed" : true,
        ).map((status) => (
          <option key={status} value={status}>
            {ORDER_STATUS_LABELS[status]}
          </option>
        ))}
      </select>

      {showSupplier && (
        <select
          className={selectClass}
          defaultValue={searchParams.get("supplierId") ?? ""}
          onChange={(e) => update("supplierId", e.target.value)}
          aria-label="Proveedor"
        >
          <option value="">Todos los proveedores</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}

      {showDateRange && (
        <>
          <Input
            type="date"
            defaultValue={searchParams.get("from") ?? ""}
            onChange={(e) => update("from", e.target.value)}
            aria-label="Desde"
          />
          <Input
            type="date"
            defaultValue={searchParams.get("to") ?? ""}
            onChange={(e) => update("to", e.target.value)}
            aria-label="Hasta"
          />
        </>
      )}

      {(searchParams.get("q") ||
        searchParams.get("status") ||
        searchParams.get("supplierId") ||
        searchParams.get("from") ||
        searchParams.get("to")) && (
        <button
          type="button"
          className="text-left text-sm text-primary hover:underline sm:col-span-2"
          onClick={() => startTransition(() => router.push(basePath))}
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
