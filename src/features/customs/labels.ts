export const INSPECTION_STATUS_VALUES = [
  "not_required",
  "pending",
  "in_process",
  "completed",
] as const;

export type InspectionStatusValue = (typeof INSPECTION_STATUS_VALUES)[number];

export const INSPECTION_STATUS_LABELS: Record<InspectionStatusValue, string> = {
  not_required: "No requerida",
  pending: "Pendiente",
  in_process: "En proceso",
  completed: "Completada",
};
