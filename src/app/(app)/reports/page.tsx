import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/session";
import { getKpis } from "@/features/reports/service";
import {
  CycleTimeBars,
  LandedCostByMonthChart,
  OrdersByStatusChart,
} from "@/features/reports/components/charts";
import { ExportCsvButton } from "@/features/reports/components/export-csv-button";

export default async function ReportsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const role = session.user.role as Role;
  if (role !== Role.admin && role !== Role.internal_specialist) {
    redirect("/?error=forbidden");
  }

  const kpis = await getKpis();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="board-header">Analítica operativa</p>
          <h1 className="font-display text-3xl font-bold text-foreground">Reportes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            KPIs desde recepción de orden hasta costeo final
          </p>
        </div>
        <ExportCsvButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="board-panel p-4">
          <p className="board-header">Órdenes totales</p>
          <p className="mt-2 font-mono text-3xl text-foreground">{kpis.totals.orders}</p>
        </div>
        <div className="board-panel p-4">
          <p className="board-header">Cerradas</p>
          <p className="mt-2 font-mono text-3xl text-primary">{kpis.totals.closed}</p>
        </div>
        <div className="board-panel p-4">
          <p className="board-header">Ciclo promedio (creada → cierre)</p>
          <p className="mt-2 font-mono text-3xl text-primary">
            {kpis.averageCycleTimeDays !== null
              ? `${kpis.averageCycleTimeDays} d`
              : "—"}
          </p>
        </div>
        <div className="board-panel p-4">
          <p className="board-header">Costo aterrizado acumulado</p>
          <p className="mt-2 font-mono text-3xl text-board-ok">
            {kpis.totals.landedCostAllTime.toLocaleString("es-ES", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="board-panel p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
            Órdenes por estado
          </h2>
          <OrdersByStatusChart data={kpis.ordersByStatus} />
        </div>

        <div className="board-panel p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
            Costo total aterrizado por mes
          </h2>
          <LandedCostByMonthChart data={kpis.totalLandedCostByMonth} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="board-panel p-6">
          <h2 className="mb-2 font-display text-lg font-semibold text-foreground">
            Cumplimiento de proveedores
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Órdenes con checklist de embarque sin documentos en «requiere corrección»
          </p>
          <div className="mb-2 flex items-end justify-between">
            <span className="font-display text-4xl font-bold text-foreground">
              {kpis.supplierComplianceRate}%
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {kpis.supplierCompliance.ordersWithoutCorrections}/
              {kpis.supplierCompliance.totalShipmentOrders} órdenes
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-sm bg-muted">
            <div
              className="h-full rounded-sm bg-gradient-to-r from-board-ok to-primary transition-all"
              style={{ width: `${Math.min(100, kpis.supplierComplianceRate)}%` }}
            />
          </div>
        </div>

        <div className="board-panel p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
            Tiempo promedio por etapa
          </h2>
          <CycleTimeBars data={kpis.averageCycleTimeByStage} />
        </div>
      </div>
    </div>
  );
}
