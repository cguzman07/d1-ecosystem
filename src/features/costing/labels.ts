export const COST_CATEGORY_VALUES = [
  "freight",
  "customs",
  "supplier_goods",
  "other",
] as const;

export type CostCategoryValue = (typeof COST_CATEGORY_VALUES)[number];

export const COST_CATEGORY_LABELS: Record<CostCategoryValue, string> = {
  freight: "Flete",
  customs: "Aduana / agencia",
  supplier_goods: "Mercancía / proveedor",
  other: "Otros",
};

export function isCostCategory(value: string): value is CostCategoryValue {
  return (COST_CATEGORY_VALUES as readonly string[]).includes(value);
}
