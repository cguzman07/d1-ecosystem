"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Check,
  Circle,
  Eye,
  FileText,
  Upload,
  AlertCircle,
} from "lucide-react";
import { updateRequiredDocumentStatusAction } from "@/features/shipment/actions";
import { getDocumentDownloadAction } from "@/features/documents/actions";
import { ChecklistStatusBadge } from "@/features/shipment/components/checklist-status-badge";
import { DocumentUploadForm } from "@/features/documents/components/document-upload-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn, formatDate } from "@/lib/utils";

type RequiredDoc = {
  id: string;
  documentType: string;
  status: string;
  correctionReason: string | null;
  document: {
    id: string;
    fileName: string;
    version: number;
    uploadedAt: Date;
    uploadedBy: { name: string };
  } | null;
};

type Props = {
  orderId: string;
  items: RequiredDoc[];
  canUpload: boolean;
  canReview: boolean;
  /** Compact card layout for order detail side panel */
  compact?: boolean;
};

function StatusIcon({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(47,111,106,0.9)] text-white shadow-soft">
        <Check className="h-4 w-4" strokeWidth={2.5} />
      </span>
    );
  }
  if (status === "needs_correction") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/25">
        <AlertCircle className="h-4 w-4" />
      </span>
    );
  }
  if (status === "submitted") {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
        <Circle className="h-3.5 w-3.5 fill-current" />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400">
      <FileText className="h-4 w-4" />
    </span>
  );
}

export function ShipmentChecklist({
  orderId,
  items,
  canUpload,
  canReview,
  compact = false,
}: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [uploadOpenId, setUploadOpenId] = useState<string | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function review(requiredDocumentId: string, status: "approved" | "needs_correction") {
    setError(null);
    const formData = new FormData();
    formData.set("requiredDocumentId", requiredDocumentId);
    formData.set("status", status);
    if (status === "needs_correction") {
      const reason = reasonById[requiredDocumentId]?.trim();
      if (!reason) {
        setError("Indica el motivo de la corrección");
        return;
      }
      formData.set("correctionReason", reason);
    }

    setPendingId(requiredDocumentId);
    startTransition(async () => {
      const result = await updateRequiredDocumentStatusAction(formData);
      setPendingId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function viewDocument(documentId: string) {
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

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Sin checklist de documentos.</p>
    );
  }

  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      {error && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {items.map((item) => {
        const showUpload = canUpload && item.status !== "approved";
        const uploadOpen = uploadOpenId === item.id;
        const showReview =
          canReview &&
          (item.status === "submitted" || item.status === "needs_correction");

        return (
          <div
            key={item.id}
            className="rounded-2xl border border-gray-100 bg-white/80 px-3.5 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.03)] transition-all duration-300 ease-in-out hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)]"
          >
            <div className="flex items-center gap-3">
              <StatusIcon status={item.status} />

              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-medium tracking-[-0.01em] text-foreground">
                  {item.documentType}
                </p>
                {item.document ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {item.document.fileName} · v{item.document.version} ·{" "}
                    {formatDate(item.document.uploadedAt)}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Sin archivo cargado
                  </p>
                )}
                {item.correctionReason && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Motivo: {item.correctionReason}
                  </p>
                )}
              </div>

              <ChecklistStatusBadge status={item.status} />

              <div className="flex shrink-0 items-center gap-1">
                {item.document && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                    disabled={pending && pendingId === item.document.id}
                    onClick={() => viewDocument(item.document!.id)}
                    aria-label="Ver documento"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                {showUpload && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "h-8 w-8 rounded-full text-muted-foreground hover:text-primary",
                      uploadOpen && "bg-primary/10 text-primary",
                    )}
                    onClick={() =>
                      setUploadOpenId((prev) => (prev === item.id ? null : item.id))
                    }
                    aria-label="Subir documento"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {showUpload && uploadOpen && (
              <div className="mt-3 border-t border-gray-100 pt-3">
                <DocumentUploadForm
                  orderId={orderId}
                  requiredDocumentId={item.id}
                  documentTypeLabel={item.documentType}
                  compact
                />
              </div>
            )}

            {showReview && (
              <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
                <div className="space-y-2">
                  <Label htmlFor={`reason-${item.id}`}>Motivo de corrección</Label>
                  <input
                    id={`reason-${item.id}`}
                    className="flex h-10 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm transition-all duration-300 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/15"
                    value={reasonById[item.id] ?? ""}
                    onChange={(e) =>
                      setReasonById((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    placeholder="Describe qué debe corregir el proveedor…"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-full"
                    disabled={pending && pendingId === item.id}
                    onClick={() => review(item.id, "approved")}
                  >
                    Aprobar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={pending && pendingId === item.id}
                    onClick={() => review(item.id, "needs_correction")}
                  >
                    Requiere corrección
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
