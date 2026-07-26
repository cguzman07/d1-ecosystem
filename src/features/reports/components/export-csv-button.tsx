"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportCsvButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onExport() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/reports/export");
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(body?.error ?? "No se pudo exportar el CSV");
          return;
        }
        const blob = await res.blob();
        const disposition = res.headers.get("Content-Disposition") ?? "";
        const match = disposition.match(/filename="?([^"]+)"?/);
        const filename = match?.[1] ?? `d1-ordenes-${Date.now()}.csv`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch {
        setError("Error de red al exportar");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={onExport} disabled={pending}>
        <Download className="h-4 w-4" />
        {pending ? "Exportando…" : "Exportar a CSV"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
