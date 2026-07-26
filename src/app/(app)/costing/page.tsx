import Link from "next/link";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/session";
import { getCostingBoard } from "@/features/costing/service";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { formatDate } from "@/lib/utils";

function formatMoney(value: { toFixed?: (n: number) => string } | number | null | undefined, currency: string) {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "number" ? value : Number(value.toString());
  if (Number.isNaN(n)) return "—";
  return `${n.toFixed(2)} ${currency}`;
}

export default async function CostingDashboardPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  if (role !== Role.admin && role !== Role.internal_specialist) {
    redirect("/?error=forbidden");
  }

  const rows = await getCostingBoard();
  const ready = rows.filter((r) => r.status === "customs_cleared").length;
  const closed = rows.filter((r) => r.status === "closed" || r.status === "costed").length;

  return (
    <div className="space-y-6">
      <div>
        <p className="board-header">Costo aterrizado</p>
        <h1 className="font-display text-3xl font-bold text-foreground">Costeo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Órdenes listas para costeo y cerradas · {ready} pendientes · {closed} finalizadas
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="board-panel p-4">
          <p className="board-header">Listas (levante)</p>
          <p className="mt-2 font-mono text-3xl text-amber-700">{ready}</p>
        </div>
        <div className="board-panel p-4">
          <p className="board-header">Costeadas / cerradas</p>
          <p className="mt-2 font-mono text-3xl text-primary">{closed}</p>
        </div>
      </div>

      <div className="board-panel overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-border font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Nº orden</th>
              <th className="px-4 py-3 font-medium">Proveedor</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Total aterrizado</th>
              <th className="px-4 py-3 font-medium">Actividad</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No hay órdenes en fase de costeo
                </td>
              </tr>
            ) : (
              rows.map((row) => (
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
                  <td className="px-4 py-3 font-mono text-foreground/80">
                    {row.costing
                      ? formatMoney(
                          row.costing.totalLandedCost,
                          row.costing.currency,
                        )
                      : "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {formatDate(row.lastActivityAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/orders/${row.id}/costing`}
                      className="text-primary hover:underline"
                    >
                      {row.status === "customs_cleared" ? "Costear" : "Ver"}
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
