"use client";

import { useState, useTransition } from "react";
import { getDocumentDownloadAction } from "@/features/documents/actions";
import {
  DOCUMENT_CATEGORY_LABELS,
  type DocumentCategoryValue,
} from "@/features/shipment/labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

type Doc = {
  id: string;
  fileName: string;
  category: string;
  version: number;
  status: string;
  fileSizeBytes: number;
  uploadedAt: Date;
  uploadedBy: { name: string };
};

type Props = {
  orderId: string;
  grouped: Record<string, Doc[]>;
};

export function DocumentsRepository({ orderId, grouped }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function download(documentId: string) {
    setError(null);
    setPendingId(documentId);
    startTransition(async () => {
      const result = await getDocumentDownloadAction(documentId, orderId);
      setPendingId(null);
      if (!result.ok || !result.url) {
        setError(result.ok ? "No se pudo generar el enlace" : result.error);
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  const categories = Object.keys(grouped) as DocumentCategoryValue[];
  const hasAny = categories.some((c) => (grouped[c] ?? []).length > 0);

  if (!hasAny) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay documentos cargados para esta orden.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {categories.map((category) => {
        const docs = grouped[category] ?? [];
        if (docs.length === 0) return null;
        return (
          <div key={category} className="space-y-3">
            <h3 className="board-header">
              {DOCUMENT_CATEGORY_LABELS[category] ?? category}
            </h3>
            <div className="board-panel divide-y divide-border overflow-hidden">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{doc.fileName}</p>
                      <Badge variant={doc.status === "active" ? "ok" : "muted"}>
                        {doc.status === "active" ? "Activo" : "Reemplazado"}
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">v{doc.version}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {doc.uploadedBy.name} · {formatDate(doc.uploadedAt)} ·{" "}
                      {(doc.fileSizeBytes / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending && pendingId === doc.id}
                    onClick={() => download(doc.id)}
                  >
                    {pending && pendingId === doc.id ? "Generando…" : "Descargar"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
