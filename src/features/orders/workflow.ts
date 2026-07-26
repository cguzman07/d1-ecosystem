import {
  DocumentChecklistStatus,
  OrderStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";

/** Statuses where the supplier may still feed shipment documents */
export const SUPPLIER_DOC_STATUSES: OrderStatus[] = [
  OrderStatus.created,
  OrderStatus.booking_pending,
];

/** Statuses where customs may register / continue the expediente */
export const CUSTOMS_ACTION_STATUSES: OrderStatus[] = [
  OrderStatus.shipped,
  OrderStatus.customs_in_process,
];

export type WorkflowReadiness = {
  shipmentDocsApproved: boolean;
  supplierCanUpload: boolean;
  bookingCanAct: boolean;
  customsCanAct: boolean;
  costingCanFinalize: boolean;
  waitingLabel: string | null;
};

export async function getShipmentDocsApproval(orderId: string): Promise<{
  total: number;
  approved: number;
  allApproved: boolean;
}> {
  const shipment = await prisma.shipmentRecord.findUnique({
    where: { orderId },
    include: { requiredDocuments: { select: { status: true } } },
  });
  const docs = shipment?.requiredDocuments ?? [];
  const total = docs.length;
  const approved = docs.filter(
    (d) => d.status === DocumentChecklistStatus.approved,
  ).length;
  return {
    total,
    approved,
    allApproved: total > 0 && approved === total,
  };
}

export function buildWorkflowReadiness(
  status: OrderStatus,
  shipmentDocsApproved: boolean,
): WorkflowReadiness {
  const supplierCanUpload =
    SUPPLIER_DOC_STATUSES.includes(status) && !shipmentDocsApproved;
  const bookingCanAct =
    shipmentDocsApproved &&
    (status === OrderStatus.created ||
      status === OrderStatus.booking_pending ||
      status === OrderStatus.booked ||
      status === OrderStatus.shipped);
  const customsCanAct = CUSTOMS_ACTION_STATUSES.includes(status);
  const costingCanFinalize = status === OrderStatus.customs_cleared;

  let waitingLabel: string | null = null;
  if (!shipmentDocsApproved && !SUPPLIER_DOC_STATUSES.includes(status)) {
    waitingLabel = "En espera de fase anterior";
  } else if (!shipmentDocsApproved) {
    waitingLabel = null; // supplier's turn — not "waiting"
  }

  return {
    shipmentDocsApproved,
    supplierCanUpload,
    bookingCanAct: Boolean(bookingCanAct && shipmentDocsApproved),
    customsCanAct,
    costingCanFinalize,
    waitingLabel,
  };
}

/** Booking panel: ready only when docs are fully approved and not past customs */
export function isBookingActionReady(
  status: OrderStatus,
  shipmentDocsApproved: boolean,
): boolean {
  if (!shipmentDocsApproved) return false;
  return (
    status === OrderStatus.created ||
    status === OrderStatus.booking_pending ||
    status === OrderStatus.booked ||
    status === OrderStatus.shipped
  );
}

export function isCustomsActionReady(status: OrderStatus): boolean {
  return CUSTOMS_ACTION_STATUSES.includes(status);
}

export function isShipmentActionReady(
  status: OrderStatus,
  shipmentDocsApproved: boolean,
): boolean {
  return SUPPLIER_DOC_STATUSES.includes(status) && !shipmentDocsApproved;
}

export function assertSupplierCanUploadDocuments(params: {
  status: OrderStatus;
  shipmentDocsApproved: boolean;
}): void {
  if (!SUPPLIER_DOC_STATUSES.includes(params.status)) {
    throw new Error(
      "No puede cargar documentos porque el caso ya avanzó de la fase de embarque documental",
    );
  }
  if (params.shipmentDocsApproved) {
    throw new Error(
      "No puede cargar más documentos: el checklist de embarque ya está completamente aprobado",
    );
  }
}

export function assertForwarderCanRegisterBooking(params: {
  status: OrderStatus;
  shipmentDocsApproved: boolean;
}): void {
  if (!params.shipmentDocsApproved) {
    throw new Error(
      "No puede registrar booking/SARPE porque los documentos de embarque no están aprobados",
    );
  }
  const blocked: OrderStatus[] = [
    OrderStatus.customs_in_process,
    OrderStatus.customs_cleared,
    OrderStatus.costed,
    OrderStatus.closed,
  ];
  if (blocked.includes(params.status)) {
    throw new Error(
      "No puede modificar el booking porque el caso ya está en aduana o cerrado",
    );
  }
}

export function assertCustomsCanRegister(params: { status: OrderStatus }): void {
  if (!CUSTOMS_ACTION_STATUSES.includes(params.status)) {
    throw new Error(
      "No puede registrar aduana porque el caso no ha sido embarcado",
    );
  }
}

export function assertCostingCanFinalize(params: { status: OrderStatus }): void {
  if (params.status !== OrderStatus.customs_cleared) {
    throw new Error(
      "No puede finalizar el costeo porque el caso no tiene levante (aduana liberada)",
    );
  }
}

/** Prisma select helper for boards that need checklist rollup */
export const shipmentDocsSelect = {
  requiredDocuments: { select: { status: true } },
} satisfies Prisma.ShipmentRecordSelect;

export function docsApprovedFromShipment(
  shipment: { requiredDocuments: { status: DocumentChecklistStatus }[] } | null,
): boolean {
  const docs = shipment?.requiredDocuments ?? [];
  return (
    docs.length > 0 &&
    docs.every((d) => d.status === DocumentChecklistStatus.approved)
  );
}
