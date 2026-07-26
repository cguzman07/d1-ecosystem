import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/session";
import { getCustomsBoard } from "@/features/customs/service";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { InspectionStatusBadge } from "@/features/customs/components/inspection-status-badge";
import { Badge } from "@/components/ui/badge";
import { isCustomsActionReady } from "@/features/orders/workflow";
import { formatDate } from "@/lib/utils";

export default async function CustomsDashboardPage({
  searchParams,
}: {
  searchParams: { inProcessOnly?: string; error?: string };
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  const allowed: Role[] = [
    Role.admin,
    Role.internal_specialist,
    Role.customs_agency,
  ];
  if (!allowed.includes(role)) redirect("/customs?error=forbidden");

  const agencyUserId =
    role === Role.customs_agency ? session.user.id : undefined;

  const inProcessOnly = searchParams.inProcessOnly === "1";

  const rows = await getCustomsBoard({
    agencyUserId,
    inProcessOnly,
  });

  return (
    <div className="space-y-6">
      {searchParams.error === "forbidden" && (
        <div className="rounded-xl border border-secondary bg-secondary/40 px-4 py-3 text-sm text-amber-900">
          No tienes permiso para acceder a esa sección.
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="board-header">Despacho aduanero</p>
          <h1 className="font-display text-3xl font-bold text-foreground">
            {role === Role.customs_agency ? "Mis Casos en Aduana" : "Aduana"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {role === Role.customs_agency
              ? "Solo los casos asignados a tu agencia"
              : "Órdenes en proceso aduanero"}{" "}
            · {rows.length} visible{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href={inProcessOnly ? "/customs" : "/customs?inProcessOnly=1"}
          className="rounded-md border border-border px-3 py-2 text-sm text-foreground/80 hover:bg-muted"
        >
          {inProcessOnly ? "Ver embarcadas + en proceso + levante" : "Solo en proceso"}
        </Link>
      </div>

      <div className="board-panel overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-border font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Nº orden</th>
              <th className="px-4 py-3 font-medium">Proveedor</th>
              <th className="px-4 py-3 font-medium">Estado orden</th>
              <th className="px-4 py-3 font-medium">Pipeline</th>
              <th className="px-4 py-3 font-medium">Nº declaración</th>
              <th className="px-4 py-3 font-medium">Inspección</th>
              <th className="px-4 py-3 font-medium">Levante</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  No hay órdenes en este filtro
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const ready = isCustomsActionReady(row.status);
                return (
                  <tr
                    key={row.id}
                    className="border-b border-border hover:bg-primary/5"
                  >
                    <td className="px-4 py-3 font-mono text-primary">
                      {row.orderNumber}
                    </td>
                    <td className="px-4 py-3 text-foreground">{row.supplier.name}</td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      {ready ? (
                        <Badge variant="ok">Listo para aduana</Badge>
                      ) : (
                        <Badge variant="warn">En espera de fase anterior</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {row.customs?.declarationNumber || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {row.customs ? (
                        <InspectionStatusBadge status={row.customs.inspectionStatus} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {formatDate(row.customs?.releaseDate)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {ready ? (
                        <Link
                          href={`/orders/${row.id}/customs`}
                          className="text-primary hover:underline"
                        >
                          Gestionar
                        </Link>
                      ) : (
                        <span className="cursor-not-allowed text-muted-foreground/60">
                          Registrar Levante
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
