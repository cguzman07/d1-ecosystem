import {
  BOOKING_FIELD_LABELS,
  BOOKING_STATUS_LABELS,
  type BookingStatusValue,
} from "@/features/booking/labels";
import { formatDate } from "@/lib/utils";
import type { BookingDetail } from "@/features/booking/service";

type Revision = BookingDetail["revisions"][number];

function formatRevisionValue(fieldName: string, value: string | null): string {
  if (value === null || value === "") return "—";
  if (fieldName === "status") {
    return BOOKING_STATUS_LABELS[value as BookingStatusValue] ?? value;
  }
  if (fieldName === "departureDate" || fieldName === "arrivalDate") {
    return formatDate(value);
  }
  return value;
}

export function BookingRevisionHistory({ revisions }: { revisions: Revision[] }) {
  if (revisions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay roleos registrados. Cada cambio de fechas, contenedores o naviera
        quedará aquí.
      </p>
    );
  }

  return (
    <ol className="relative space-y-0 border-l border-secondary pl-6">
      {revisions.map((rev, index) => (
        <li key={rev.id} className="relative pb-6 last:pb-0">
          <span
            className={`absolute -left-[1.625rem] mt-1.5 h-3 w-3 rounded-full ring-4 ring-card ${
              index === 0 ? "bg-secondary" : "bg-muted-foreground"
            }`}
          />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {BOOKING_FIELD_LABELS[rev.fieldName] ?? rev.fieldName}
            </p>
            <p className="font-mono text-xs text-foreground/80">
              <span className="text-muted-foreground">{formatRevisionValue(rev.fieldName, rev.oldValue)}</span>
              {" → "}
              <span className="text-foreground">
                {formatRevisionValue(rev.fieldName, rev.newValue)}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(rev.createdAt)} · {rev.changedBy.name}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
