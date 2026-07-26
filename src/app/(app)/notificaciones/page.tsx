import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default async function NotificacionesPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: {
      recipientId: session.user.id,
      channel: "in_app",
    },
    orderBy: { sentAt: "desc" },
    take: 50,
    include: {
      order: { select: { id: true, orderNumber: true } },
    },
  });

  const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
  if (unreadIds.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: unreadIds } },
      data: { read: true },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="board-header">Centro</p>
        <h1 className="font-display text-3xl font-bold text-foreground">Notificaciones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Avisos en la app (el correo se envía con Resend)
        </p>
      </div>

      <div className="board-panel divide-y divide-border">
        {notifications.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No hay notificaciones
          </p>
        ) : (
          notifications.map((n) => (
            <div key={n.id} className="flex flex-col gap-1 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">{n.title}</p>
                  {!n.read && <Badge variant="warn">Nueva</Badge>}
                </div>
                <p className="text-sm text-foreground/80">{n.message}</p>
                {n.order && (
                  <Link
                    href={`/orders/${n.order.id}/booking`}
                    className="text-sm text-primary hover:underline"
                  >
                    Ver {n.order.orderNumber}
                  </Link>
                )}
              </div>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {formatDate(n.sentAt)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
