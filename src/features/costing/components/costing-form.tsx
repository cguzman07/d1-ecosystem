"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  finalizeCostingAction,
  saveCostingAction,
} from "@/features/costing/actions";
import {
  COST_CATEGORY_LABELS,
  COST_CATEGORY_VALUES,
  type CostCategoryValue,
} from "@/features/costing/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LineDraft = {
  key: string;
  category: CostCategoryValue;
  description: string;
  amount: string;
  currency: string;
};

type Props = {
  orderId: string;
  currency?: string;
  notes?: string | null;
  closed?: boolean;
  initialLines?: {
    id: string;
    category: string;
    description: string;
    amount: string | number;
    currency: string;
  }[];
};

function newKey() {
  return `tmp-${Math.random().toString(36).slice(2, 10)}`;
}

function toNumber(amount: string): number {
  const n = Number.parseFloat(amount.replace(",", "."));
  return Number.isNaN(n) ? 0 : n;
}

export function CostingForm({
  orderId,
  currency = "USD",
  notes: initialNotes,
  closed = false,
  initialLines = [],
}: Props) {
  const router = useRouter();
  const [lines, setLines] = useState<LineDraft[]>(
    initialLines.length > 0
      ? initialLines.map((l) => ({
          key: l.id,
          category: (COST_CATEGORY_VALUES.includes(l.category as CostCategoryValue)
            ? l.category
            : "other") as CostCategoryValue,
          description: l.description,
          amount: String(l.amount),
          currency: l.currency || currency,
        }))
      : [
          {
            key: newKey(),
            category: "freight",
            description: "",
            amount: "",
            currency,
          },
        ],
  );
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [baseCurrency, setBaseCurrency] = useState(currency);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + toNumber(line.amount), 0),
    [lines],
  );

  const hasValidLine = lines.some(
    (l) => l.description.trim().length > 0 && toNumber(l.amount) !== 0,
  );

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        key: newKey(),
        category: "other",
        description: "",
        amount: "",
        currency: baseCurrency,
      },
    ]);
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)));
  }

  function buildFormData() {
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("notes", notes);
    formData.set("currency", baseCurrency);
    formData.set(
      "lineItemsJson",
      JSON.stringify(
        lines
          .filter((l) => l.description.trim().length > 0)
          .map((l) => ({
            category: l.category,
            description: l.description.trim(),
            amount: toNumber(l.amount),
            currency: l.currency || baseCurrency,
          })),
      ),
    );
    return formData;
  }

  function onSave() {
    setError(null);
    setSuccess(null);
    const formData = buildFormData();
    startTransition(async () => {
      const result = await saveCostingAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Costeo guardado. Total recalculado desde las líneas.");
      router.refresh();
    });
  }

  function onFinalize() {
    if (!hasValidLine) return;
    setError(null);
    setSuccess(null);
    const formData = buildFormData();
    startTransition(async () => {
      const result = await finalizeCostingAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Costeo finalizado. La orden quedó costeada y cerrada.");
      router.refresh();
    });
  }

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  if (closed) {
    return (
      <div className="space-y-4">
        <p className="rounded-md border border-board-ok/30 bg-board-ok/10 px-4 py-3 text-sm text-board-ok">
          Este costeo está finalizado y la orden está cerrada. Las líneas ya no se pueden
          editar.
        </p>
        <div className="space-y-2">
          {lines.map((line) => (
            <div
              key={line.key}
              className="grid gap-2 rounded-md border border-border px-3 py-2 text-sm sm:grid-cols-[1fr_1.4fr_0.8fr]"
            >
              <span className="text-muted-foreground">
                {COST_CATEGORY_LABELS[line.category]}
              </span>
              <span className="text-foreground">{line.description}</span>
              <span className="font-mono text-right text-primary">
                {toNumber(line.amount).toFixed(2)} {line.currency}
              </span>
            </div>
          ))}
        </div>
        <div className="flex justify-between border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">Costo total aterrizado</span>
          <span className="font-display text-2xl font-bold text-foreground">
            {total.toFixed(2)} {baseCurrency}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="currency">Moneda</Label>
          <Input
            id="currency"
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value.toUpperCase())}
            maxLength={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Notas</Label>
          <Input
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observaciones del costeo…"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground/80">Líneas de costo</h3>
          <Button type="button" size="sm" variant="outline" onClick={addLine}>
            Agregar línea
          </Button>
        </div>

        {lines.map((line) => (
          <div
            key={line.key}
            className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_1.5fr_0.8fr_auto]"
          >
            <select
              className={selectClass}
              value={line.category}
              onChange={(e) =>
                updateLine(line.key, {
                  category: e.target.value as CostCategoryValue,
                })
              }
              aria-label="Categoría"
            >
              {COST_CATEGORY_VALUES.map((c) => (
                <option key={c} value={c}>
                  {COST_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <Input
              placeholder="Descripción"
              value={line.description}
              onChange={(e) => updateLine(line.key, { description: e.target.value })}
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Monto"
              value={line.amount}
              onChange={(e) => updateLine(line.key, { amount: e.target.value })}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => removeLine(line.key)}
              disabled={lines.length <= 1}
            >
              Quitar
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-primary/20 pt-4">
        <div>
          <p className="board-header">Costo total aterrizado (calculado)</p>
          <p className="font-display text-3xl font-bold text-primary">
            {total.toFixed(2)}{" "}
            <span className="text-lg text-muted-foreground">{baseCurrency}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Calculado automáticamente desde las líneas. No se edita a mano.
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      {success && (
        <p className="rounded-md bg-board-ok/10 px-3 py-2 text-sm text-board-ok">
          {success}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" disabled={pending} onClick={onSave}>
          {pending ? "Guardando…" : "Guardar borrador"}
        </Button>
        <Button
          type="button"
          disabled={pending || !hasValidLine}
          onClick={onFinalize}
        >
          {pending ? "Finalizando…" : "Finalizar costeo y cerrar orden"}
        </Button>
      </div>
    </div>
  );
}
