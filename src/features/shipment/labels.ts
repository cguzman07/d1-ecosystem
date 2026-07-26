export const DEFAULT_SHIPMENT_DOCUMENTS = [
  "Factura comercial",
  "Lista de empaque",
  "Conocimiento de embarque (BL / AWB)",
] as const;

export const CHECKLIST_STATUS_VALUES = [
  "pending",
  "submitted",
  "needs_correction",
  "approved",
] as const;

export type ChecklistStatusValue = (typeof CHECKLIST_STATUS_VALUES)[number];

export const CHECKLIST_STATUS_LABELS: Record<ChecklistStatusValue, string> = {
  pending: "Pendiente",
  submitted: "Enviado",
  needs_correction: "Requiere corrección",
  approved: "Aprobado",
};

export const DOCUMENT_CATEGORY_VALUES = [
  "shipment",
  "customs",
  "costing",
  "general",
] as const;

export type DocumentCategoryValue = (typeof DOCUMENT_CATEGORY_VALUES)[number];

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategoryValue, string> = {
  shipment: "Embarque",
  customs: "Aduana",
  costing: "Costeo",
  general: "General",
};
