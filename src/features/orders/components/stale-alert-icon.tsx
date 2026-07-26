import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function StaleAlertIcon({
  stale,
  className,
}: {
  stale: boolean;
  className?: string;
}) {
  if (!stale) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-amber-600",
        className,
      )}
      title="Sin avance en creada / booking pendiente por más de 3 días"
    >
      <AlertTriangle className="h-4 w-4 animate-board-pulse" />
      <span className="sr-only">Alerta de demora</span>
    </span>
  );
}
