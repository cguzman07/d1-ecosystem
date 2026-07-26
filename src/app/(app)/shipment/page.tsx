import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { AlertTriangle } from "lucide-react";
import { getSession } from "@/lib/session";
import { getSupplierIdForUser } from "@/features/orders/service";
import { getShipmentBoard } from "@/features/shipment/service";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { Badge } from "@/components/ui/badge";
import { isShipmentActionReady } from "@/features/orders/workflow";
import { formatDate } from "@/lib/utils";

export default async function ShipmentDashboardPage({
  searchParams,
}: {
  searchParams: { alertOnly?: string; error?: string };
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  const allowed: Role[] = [Role.admin, Role.internal_specialist, Role.supplier];
  if (!allowed.includes(role)) redirect("/shipment?error=forbidden");

  const supplierId =
    role === Role.supplier ? await getSupplierIdForUser(session.user.id) : undefined;

  if (role === Role.supplier && !supplierId) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-bold text-foreground">
          Mis Embarques Pendientes
        </h1>
        <p className="text-sm text-muted-foreground">
          Tu usuario no está vinculado a un proveedor en datos maestros.
        </p>
      </div>
    );
  }

  const rows = await getShipmentBoard({
    supplierId: supplierId ?? undefined,
    supplierScopeOnly: role === Role.supplier,
    alertOnly: searchParams.alertOnly === "1",
  });

  const alertCount = rows.filter((r) => r.hasAlert).length;

  return (
    <div className="space-y-6">
      {searchParams.error === "forbidden" && (
        <div className="rounded-xl border border-secondary bg-secondary/40 px-4 py-3 text-sm text-amber-900">
          No tienes permiso para acceder a esa sección.
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="board-header">Documentación de embarque</p>
          <h1 className="font-display text-3xl font-bold text-foreground">
            {role === Role.supplier ? "Mis Embarques Pendientes" : "Embarque"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {role === Role.supplier
              ? "Carga inicial de documentos · fase previa al booking"
              : "Checklist documental por orden"}{" "}
            · {rows.length} visible{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href={searchParams.alertOnly === "1" ? "/shipment" : "/shipment?alertOnly=1"}
          className="inline-flex items-center gap-2 rounded-md border border-secondary bg-secondary/50 px-3 py-2 text-sm text-amber-800 hover:bg-secondary"
        >
          <AlertTriangle className="h-4 w-4" />
          {searchParams.alertOnly === "1"
            ? "Ver todas"
            : `Solo alertas (${alertCount})`}
        </Link>
      </div>

      <div className="board-panel overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-border font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Orden</th>
              <th className="px-4 py-3 font-medium">Proveedor</th>
              <th className="px-4 py-3 font-medium">Estado orden</th>
              <th className="px-4 py-3 font-medium">Pipeline</th>
              <th className="px-4 py-3 font-medium">Checklist</th>
              <th className="px-4 py-3 font-medium">Alertas</th>
              <th className="px-4 py-3 font-medium">Actividad</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  No hay órdenes en fase documental
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const docsApproved =
                  row.checklist.total > 0 &&
                  row.checklist.approved === row.checklist.total;
                const ready = isShipmentActionReady(row.status, docsApproved);
                return (
                  <tr
                    key={row.id}
                    className="border-b border-border hover:bg-primary/5"
                  >
                    <td className="px-4 py-3 font-mono text-primary">{row.orderNumber}</td>
                    <td className="px-4 py-3 text-foreground">{row.supplier.name}</td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      {ready ? (
                        <Badge variant="ok">Listo para documentos</Badge>
                      ) : (
                        <Badge variant="warn">En espera de fase anterior</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {row.shipment
                        ? `${row.checklist.approved}/${row.checklist.total} aprob. · ${row.checklist.submitted} env. · ${row.checklist.missing} pend.`
                        : "Sin checklist"}
                    </td>
                    <td className="px-4 py-3">
                      {row.hasAlert ? (
                        <span className="inline-flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="h-4 w-4 animate-board-pulse" />
                          {row.checklist.needsCorrection > 0
                            ? "Corrección"
                            : "Docs faltantes"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {formatDate(row.lastActivityAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {ready || role !== Role.supplier ? (
                        <Link
                          href={`/orders/${row.id}/shipment`}
                          className="text-primary hover:underline"
                        >
                          Gestionar
                        </Link>
                      ) : (
                        <span className="cursor-not-allowed text-muted-foreground/60">
                          Gestionar
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
