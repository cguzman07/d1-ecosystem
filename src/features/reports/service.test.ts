import { describe, expect, it } from "vitest";
import { ordersToCsv, type OrderExportRow } from "@/features/reports/service";

describe("ordersToCsv", () => {
  it("escapes commas and includes BOM", () => {
    const rows: OrderExportRow[] = [
      {
        orderNumber: "ORD-2026-001",
        sapReference: null,
        status: "closed",
        statusLabel: "Cerrada",
        supplierName: "Acme, Inc",
        supplierCountry: "China",
        forwarderName: "Andes Cargo",
        customsAgencyName: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        lastActivityAt: "2026-01-10T00:00:00.000Z",
        totalLandedCost: "1234.50",
        currency: "USD",
        closedCosting: true,
      },
    ];

    const csv = ordersToCsv(rows);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Acme, Inc"');
    expect(csv).toContain("ORD-2026-001");
  });
});
