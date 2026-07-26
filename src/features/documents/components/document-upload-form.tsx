"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { uploadDocumentAction } from "@/features/documents/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_CATEGORY_VALUES,
} from "@/features/shipment/labels";
import { cn } from "@/lib/utils";

type Props = {
  orderId: string;
  requiredDocumentId?: string;
  documentTypeLabel?: string;
  showCategorySelect?: boolean;
  compact?: boolean;
};

export function DocumentUploadForm({
  orderId,
  requiredDocumentId,
  documentTypeLabel,
  showCategorySelect = false,
  compact = false,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pickFile(next: File | null) {
    setFile(next);
    setError(null);
    setSuccess(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      setError("Debes seleccionar un archivo");
      return;
    }

    const formData = new FormData(e.currentTarget);
    formData.set("orderId", orderId);
    formData.set("file", file);
    if (requiredDocumentId) {
      formData.set("requiredDocumentId", requiredDocumentId);
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await uploadDocumentAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Archivo cargado correctamente");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className={cn("space-y-3", compact && "space-y-2.5")}>
      <input type="hidden" name="orderId" value={orderId} />
      {requiredDocumentId && (
        <input type="hidden" name="requiredDocumentId" value={requiredDocumentId} />
      )}

      {documentTypeLabel && !compact && (
        <p className="text-xs text-muted-foreground">Subir para: {documentTypeLabel}</p>
      )}

      {showCategorySelect && !requiredDocumentId && (
        <div className="space-y-2">
          <Label htmlFor="category">Categoría</Label>
          <select
            id="category"
            name="category"
            defaultValue="general"
            className="flex h-10 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            {DOCUMENT_CATEGORY_VALUES.map((c) => (
              <option key={c} value={c}>
                {DOCUMENT_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div
        className={cn(
          "rounded-xl border border-dashed text-center transition-all duration-300 ease-in-out",
          compact ? "px-3 py-4" : "px-4 py-6",
          dragOver
            ? "border-[#E30613] bg-red-50 text-[#E30613]"
            : "border-gray-300 bg-white/50 text-muted-foreground hover:border-[#E30613] hover:text-[#E30613]",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const dropped = e.dataTransfer.files?.[0] ?? null;
          pickFile(dropped);
        }}
      >
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm font-medium transition-colors duration-300"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          {file ? "Cambiar archivo" : "Subir documento"}
        </button>
        <p className="mt-1 text-xs opacity-80">
          Arrastra aquí o selecciona · Máx. 10 MB
        </p>
        {file && (
          <p className="mt-2 font-display text-xs font-medium text-primary">
            {file.name} · {(file.size / 1024).toFixed(1)} KB
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-board-ok">{success}</p>}

      <Button
        type="submit"
        size="sm"
        className="rounded-full"
        disabled={pending || !file}
      >
        {pending ? "Subiendo…" : "Confirmar carga"}
      </Button>
    </form>
  );
}
