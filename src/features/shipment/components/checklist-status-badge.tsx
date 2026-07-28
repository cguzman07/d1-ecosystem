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
    className: "bg-slate-100 text-slate-700",
  },
  needs_correction: {
    label: "Revisión",
    className: "bg-primary/10 text-primary",
  },
  approved: {
    label: "Aprobado",
    className: "bg-[rgba(47,111,106,0.12)] text-[#245E5A]",
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
