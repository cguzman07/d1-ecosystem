import { cn } from "@/lib/utils";
import {
  CHECKLIST_STATUS_LABELS,
  type ChecklistStatusValue,
} from "@/features/shipment/labels";

const PILL: Record<
  ChecklistStatusValue,
  { label: string; className: string }
> = {
  pending: {
    label: "Pendiente",
    className: "bg-gray-100 text-gray-600",
  },
  submitted: {
    label: "Enviado",
    className: "bg-amber-50 text-amber-800",
  },
  needs_correction: {
    label: "Revisión",
    className: "bg-red-50 text-[#E30613]",
  },
  approved: {
    label: "Aprobado",
    className: "bg-emerald-50 text-emerald-700",
  },
};

export function ChecklistStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const key = status as ChecklistStatusValue;
  const pill = PILL[key];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide transition-all duration-300 ease-in-out",
        pill?.className ?? "bg-gray-100 text-gray-600",
        className,
      )}
    >
      {pill?.label ?? CHECKLIST_STATUS_LABELS[key] ?? status}
    </span>
  );
}
