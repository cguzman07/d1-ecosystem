import { expect, test } from "@playwright/test";

/**
 * Critical happy path: specialist creates an order and sees it on the flight board.
 * Requires DB seeded (`npm run db:seed`) and app reachable at baseURL.
 */
test.describe("Order lifecycle (specialist)", () => {
  test("login → create order → visible on flight board", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Correo electrónico").fill("especialista@d1.local");
    await page.getByLabel("Contraseña").fill("password123");
    await page.getByRole("button", { name: "Ingresar" }).click();

    await expect(page.getByRole("heading", { name: "Tablero de control" })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole("navigation").getByRole("link", { name: "Órdenes" }).click();
    await expect(page.getByRole("heading", { name: "Órdenes de compra" })).toBeVisible();

    await page.getByRole("link", { name: "Nueva orden" }).first().click();
    await expect(page.getByRole("heading", { name: "Nueva orden de compra" })).toBeVisible();

    const stamp = Date.now().toString().slice(-6);
    const sapRef = `E2E-${stamp}`;

    await page.getByLabel("Referencia SAP").fill(sapRef);
    await page.locator("#supplierId").selectOption({ index: 1 });
    await page.locator("#freightForwarderId").selectOption({ index: 1 });
    await page.locator("#customsAgencyId").selectOption({ index: 1 });
    await page.getByLabel("Notas").fill("Orden creada por prueba E2E Playwright");

    await page.getByRole("button", { name: "Crear orden" }).click();

    await expect(page).toHaveURL(/\/orders\/.+/, { timeout: 30_000 });
    await expect(page.getByText(sapRef)).toBeVisible();

    const orderHeading = page.locator("h1").first();
    const orderNumber = (await orderHeading.textContent())?.trim() ?? "";
    expect(orderNumber).toMatch(/^ORD-\d{4}-\d+$/);

    await page.getByRole("navigation").getByRole("link", { name: "Tablero" }).click();
    await expect(page.getByRole("heading", { name: "Tablero de control" })).toBeVisible();
    await expect(page.getByRole("link", { name: orderNumber })).toBeVisible();
  });
});
