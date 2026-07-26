import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getSupplierIdForUser } from "@/features/orders/service";
import { formatDate } from "@/lib/utils";

export default async function DocumentacionIndexPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  const where =
    role === Role.supplier
      ? {
          supplierId:
            (await getSupplierIdForUser(session.user.id)) ?? "__none__",
        }
      : role === Role.freight_forwarder
        ? { freightForwarderId: session.user.id }
        : role === Role.customs_agency
          ? { customsAgencyId: session.user.id }
          : {};

  const orders = await prisma.order.findMany({
    where: { ...where, status: { not: "closed" } },
    include: {
      supplier: true,
      _count: { select: { documents: true } },
    },
    orderBy: { lastActivityAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="board-header">Repositorio</p>
        <h1 className="font-display text-3xl font-bold text-foreground">Documentación</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acceso al repositorio central por orden
        </p>
      </div>

      <div className="board-panel overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="border-b border-border font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Orden</th>
              <th className="px-4 py-3 font-medium">Proveedor</th>
              <th className="px-4 py-3 font-medium">Documentos</th>
              <th className="px-4 py-3 font-medium">Actividad</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No hay órdenes disponibles
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-border hover:bg-primary/5"
                >
                  <td className="px-4 py-3 font-mono text-primary">
                    {order.orderNumber}
                  </td>
                  <td className="px-4 py-3 text-foreground">{order.supplier.name}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {order._count.documents}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {formatDate(order.lastActivityAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/orders/${order.id}/documents`}
                      className="text-primary hover:underline"
                    >
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
