"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  CycleTimePoint,
  LandedCostByMonthPoint,
  OrdersByStatusPoint,
} from "@/features/reports/service";

const tooltipStyle = {
  backgroundColor: "#FFFFFF",
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  color: "#111827",
  fontSize: 12,
};

export function OrdersByStatusChart({ data }: { data: OrdersByStatusPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
          <CartesianGrid stroke="rgba(148,163,184,0.35)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#64748b", fontSize: 11 }}
            interval={0}
            angle={-35}
            textAnchor="end"
            height={60}
          />
          <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number) => [value, "Órdenes"]}
            labelFormatter={(label) => String(label)}
          />
          <Bar dataKey="count" name="Órdenes" fill="#0F2744" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LandedCostByMonthChart({
  data,
}: {
  data: LandedCostByMonthPoint[];
}) {
  if (data.length === 0) {
    return (
      <p className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        Aún no hay costeos finalizados para graficar.
      </p>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="rgba(148,163,184,0.35)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} />
          <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number) => [
              value.toLocaleString("es-ES", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }),
              "Total aterrizado",
            ]}
          />
          <Line
            type="monotone"
            dataKey="total"
            name="Total aterrizado"
            stroke="#0F2744"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "#2F6F6A", stroke: "#0F2744", strokeWidth: 2 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CycleTimeBars({ data }: { data: CycleTimePoint[] }) {
  return (
    <div className="space-y-3">
      {data.map((row) => (
        <div key={row.stage}>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>{row.label}</span>
            <span className="font-mono text-primary">
              {row.averageDays > 0 ? `${row.averageDays} d` : "—"}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-sm bg-muted">
            <div
              className="h-full rounded-sm bg-gradient-to-r from-[#0F2744] to-[#2F6F6A]"
              style={{
                width: `${Math.min(100, (row.averageDays / 30) * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
