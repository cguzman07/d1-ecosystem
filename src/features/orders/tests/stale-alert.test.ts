import { describe, expect, it } from "vitest";
import { isStaleEarlyStage } from "@/features/orders/status";

describe("isStaleEarlyStage", () => {
  it("flags created/booking_pending orders older than the threshold", () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    expect(
      isStaleEarlyStage(
        {
          status: "created",
          createdAt: fourDaysAgo,
          lastActivityAt: fourDaysAgo,
        },
        3,
      ),
    ).toBe(true);

    expect(
      isStaleEarlyStage(
        {
          status: "booking_pending",
          createdAt: fourDaysAgo,
          lastActivityAt: fourDaysAgo,
        },
        3,
      ),
    ).toBe(true);
  });

  it("ignores later pipeline statuses and fresh early-stage orders", () => {
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    expect(
      isStaleEarlyStage(
        {
          status: "created",
          createdAt: oneDayAgo,
          lastActivityAt: oneDayAgo,
        },
        3,
      ),
    ).toBe(false);

    expect(
      isStaleEarlyStage(
        {
          status: "shipped",
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          lastActivityAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        },
        3,
      ),
    ).toBe(false);
  });
});
