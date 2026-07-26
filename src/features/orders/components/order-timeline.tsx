import { ORDER_STATUS_LABELS } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import type { OrderDetail } from "@/features/orders/service";

type HistoryItem = OrderDetail["statusHistory"][number];

export function OrderTimeline({ history }: { history: HistoryItem[] }) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Sin eventos de estado registrados.</p>
    );
  }

  return (
    <ol className="relative space-y-0 border-l border-primary/30 pl-6">
      {history.map((event, index) => {
        const isLatest = index === history.length - 1;
        return (
          <li key={event.id} className="relative pb-8 last:pb-0">
            <span
              className={`absolute -left-[1.625rem] mt-1.5 h-3 w-3 rounded-full ring-4 ring-card ${
                isLatest ? "bg-primary" : "bg-muted-foreground"
              }`}
            />
            <div className="space-y-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-sm font-semibold text-foreground">
                  {ORDER_STATUS_LABELS[event.newStatus] ?? event.newStatus}
                </span>
                {event.previousStatus && (
                  <span className="text-xs text-muted-foreground">
                    desde {ORDER_STATUS_LABELS[event.previousStatus] ?? event.previousStatus}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDate(event.createdAt)} · {event.changedBy.name}
              </p>
              {event.note && (
                <p className="text-sm text-foreground/80">{event.note}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
