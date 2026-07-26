export const BOOKING_STATUS_VALUES = [
  "no_booking",
  "with_booking",
  "shipped",
] as const;

export type BookingStatusValue = (typeof BOOKING_STATUS_VALUES)[number];

export const BOOKING_STATUS_LABELS: Record<BookingStatusValue, string> = {
  no_booking: "Sin booking",
  with_booking: "Con booking",
  shipped: "Embarcado",
};

export const BOOKING_FIELD_LABELS: Record<string, string> = {
  departureDate: "Fecha SARPE (salida)",
  arrivalDate: "Fecha de llegada",
  containerNumbers: "Contenedores",
  carrier: "Naviera / transportista",
  status: "Estado de booking",
};
