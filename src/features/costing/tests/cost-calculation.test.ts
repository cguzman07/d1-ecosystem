import { describe, expect, it } from "vitest";
import { computeCostRollups } from "@/features/costing/service";

describe("computeCostRollups", () => {
  it("sums line items into category rollups and totalLandedCost", () => {
    const result = computeCostRollups([
      { category: "freight", description: "Flete marítimo", amount: 1200 },
      { category: "customs", description: "Agenciamiento", amount: 350.5 },
      { category: "supplier_goods", description: "Mercancía", amount: 10000 },
      { category: "other", description: "Seguro", amount: 100 },
      { category: "unknown", description: "Extra", amount: 50 },
    ]);

    expect(result.freightCost.toNumber()).toBe(1200);
    expect(result.customsFees.toNumber()).toBe(350.5);
    expect(result.supplierGoodsCost.toNumber()).toBe(10000);
    expect(result.otherCosts.toNumber()).toBe(150);
    expect(result.totalLandedCost.toNumber()).toBe(11700.5);
  });

  it("never trusts a manual total — empty lines yield zero", () => {
    const result = computeCostRollups([]);
    expect(result.totalLandedCost.toNumber()).toBe(0);
    expect(result.freightCost.toNumber()).toBe(0);
  });

  it("recalculates when lines change (add / remove)", () => {
    const before = computeCostRollups([
      { category: "freight", description: "Flete", amount: 500 },
    ]);
    expect(before.totalLandedCost.toNumber()).toBe(500);

    const after = computeCostRollups([
      { category: "freight", description: "Flete", amount: 500 },
      { category: "customs", description: "Aduana", amount: 200 },
    ]);
    expect(after.totalLandedCost.toNumber()).toBe(700);
    expect(after.customsFees.toNumber()).toBe(200);
  });
});
