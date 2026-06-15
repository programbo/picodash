import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("updates controls and persists values", async ({ page }) => {
  await page.getByRole("textbox", { name: "Exposure" }).fill("2.5");
  await page.getByRole("textbox", { name: "Exposure" }).press("Enter");
  await page.getByRole("checkbox", { name: "Bloom" }).uncheck();
  await page.getByRole("combobox", { name: "Tint" }).selectOption("amber");

  await expect(page.getByText("Exposure 2.5")).toBeVisible();
  await expect(page.locator(".preview__object")).not.toHaveClass(/has-bloom/);

  await page.reload();

  await expect(page.getByRole("textbox", { name: "Exposure" })).toHaveValue("2.5");
  await expect(page.getByRole("checkbox", { name: "Bloom" })).not.toBeChecked();
  await expect(page.getByRole("combobox", { name: "Tint" })).toHaveValue("amber");
});

test("programmatic setter updates the panel and preview", async ({ page }) => {
  await page.getByRole("button", { name: "Set speed to 1.25" }).click();

  await expect(page.getByText("Speed 1.25")).toBeVisible();
  await expect(page.getByRole("slider", { name: "Speed" })).toHaveValue("1.25");
});

test("collapses and persists panel state", async ({ page }) => {
  await page.getByRole("button", { name: "Collapse panel" }).click();

  await expect(page.getByRole("slider", { name: "Speed" })).toBeHidden();
  await page.reload();
  await expect(page.getByRole("button", { name: "Expand panel" })).toBeVisible();
});

test("resets values separately from order", async ({ page }) => {
  await page.getByRole("textbox", { name: "Exposure" }).fill("3");
  await page.getByRole("textbox", { name: "Exposure" }).press("Enter");
  await page.getByRole("button", { name: "Reset values" }).click();

  await expect(page.getByRole("textbox", { name: "Exposure" })).toHaveValue("1");
});

test("docks the panel near a viewport edge", async ({ page }) => {
  const header = page.locator(".tw-panel__header");
  const box = await header.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box!.x + 80, box!.y + 16);
  await page.mouse.down();
  await page.mouse.move(2, box!.y + 24, { steps: 8 });
  await page.mouse.up();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const raw = localStorage.getItem("tweaker:docs-demo");
        return raw ? JSON.parse(raw).state?.dock?.edge : null;
      }),
    )
    .toBe("left");
});

test("reorders controls within a section by pointer-dragging the grip", async ({ page }) => {
  const speedGrip = page.getByRole("button", { name: "Reorder Speed" });
  const exposureRow = page.getByTestId("control-exposure");
  const speedBox = await speedGrip.boundingBox();
  const exposureBox = await exposureRow.boundingBox();
  expect(speedBox).not.toBeNull();
  expect(exposureBox).not.toBeNull();

  await page.mouse.move(speedBox!.x + speedBox!.width / 2, speedBox!.y + speedBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    exposureBox!.x + exposureBox!.width / 2,
    exposureBox!.y + exposureBox!.height - 3,
    { steps: 12 },
  );
  await page.mouse.up();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const raw = localStorage.getItem("tweaker:docs-demo");
        return raw ? (JSON.parse(raw).state?.order?.Rendering ?? []) : [];
      }),
    )
    .toContain("docs-demo:Rendering:speed");
});

test("reorders controls within a section by keyboard on the grip", async ({ page }) => {
  const speedGrip = page.getByRole("button", { name: "Reorder Speed" });
  await speedGrip.focus();
  await page.keyboard.press("ArrowDown");

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const raw = localStorage.getItem("tweaker:docs-demo");
        return raw ? (JSON.parse(raw).state?.order?.Rendering ?? []) : [];
      }),
    )
    .toContain("docs-demo:Rendering:speed");
});

test("can disable sorting per hook registration", async ({ page }) => {
  const channelGrip = page.getByRole("button", {
    name: "Reordering disabled for Channel",
  });
  const telemetryRow = page.getByTestId("control-telemetry");
  const channelBox = await channelGrip.boundingBox();
  const telemetryBox = await telemetryRow.boundingBox();
  expect(channelBox).not.toBeNull();
  expect(telemetryBox).not.toBeNull();

  await page.mouse.move(
    channelBox!.x + channelBox!.width / 2,
    channelBox!.y + channelBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    telemetryBox!.x + telemetryBox!.width / 2,
    telemetryBox!.y + telemetryBox!.height - 3,
    { steps: 12 },
  );
  await page.mouse.up();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const raw = localStorage.getItem("tweaker:docs-demo");
        return raw ? (JSON.parse(raw).state?.order?.Build ?? []) : [];
      }),
    )
    .toEqual([]);
});

test("applies hook-level panel effects with hover transitions", async ({ page }) => {
  const panel = page.getByTestId("tweaker-panel");
  const exposureInput = page.getByRole("textbox", { name: "Exposure" });

  await expect(panel).toHaveCSS("opacity", "1");
  await expect(panel).toHaveCSS("background-color", "rgba(21, 22, 23, 0.55)");
  await expect(exposureInput).toHaveCSS("background-color", "rgba(16, 17, 18, 0.55)");
  await expect(panel).toHaveCSS("backdrop-filter", "blur(0px)");
  await expect
    .poll(() => panel.evaluate((element) => getComputedStyle(element).transitionProperty))
    .toContain("background-color");
  await expect
    .poll(() => panel.evaluate((element) => getComputedStyle(element).transitionProperty))
    .toContain("backdrop-filter");

  await panel.hover();

  await expect(panel).toHaveCSS("opacity", "1");
  await expect(panel).toHaveCSS("background-color", "rgba(21, 22, 23, 0.95)");
  await expect(exposureInput).toHaveCSS("background-color", "rgba(16, 17, 18, 0.95)");
  await expect(panel).toHaveCSS("backdrop-filter", "blur(8px)");
});

test("applies hover panel effects while keyboard focus is inside the panel", async ({ page }) => {
  const panel = page.getByTestId("tweaker-panel");
  const exposureInput = page.getByRole("textbox", { name: "Exposure" });

  await expect(panel).toHaveCSS("opacity", "1");
  await expect(panel).toHaveCSS("background-color", "rgba(21, 22, 23, 0.55)");
  await expect(exposureInput).toHaveCSS("background-color", "rgba(16, 17, 18, 0.55)");
  await page.getByRole("slider", { name: "Speed" }).focus();
  await expect(panel).toHaveCSS("opacity", "1");
  await expect(panel).toHaveCSS("background-color", "rgba(21, 22, 23, 0.95)");
  await expect(exposureInput).toHaveCSS("background-color", "rgba(16, 17, 18, 0.95)");
  await expect(panel).toHaveCSS("backdrop-filter", "blur(8px)");
});

test("updates hook-level panel effects from runtime state", async ({ page }) => {
  const panel = page.getByTestId("tweaker-panel");
  const exposureInput = page.getByRole("textbox", { name: "Exposure" });

  await expect(panel).toHaveCSS("opacity", "1");
  await expect(panel).toHaveCSS("background-color", "rgba(21, 22, 23, 0.55)");
  await expect(exposureInput).toHaveCSS("background-color", "rgba(16, 17, 18, 0.55)");
  await expect(panel).toHaveCSS("backdrop-filter", "blur(0px)");
  await page.getByRole("button", { name: "Disable dimming" }).click();
  await expect(panel).toHaveCSS("opacity", "1");
  await expect(panel).toHaveCSS("background-color", "rgb(21, 22, 23)");
  await expect(exposureInput).toHaveCSS("background-color", "rgb(16, 17, 18)");
  await expect(panel).toHaveCSS("backdrop-filter", "blur(8px)");
  await page.getByRole("button", { name: "Enable dimming" }).click();
  await expect(panel).toHaveCSS("opacity", "1");
  await expect(panel).toHaveCSS("background-color", "rgba(21, 22, 23, 0.55)");
  await expect(exposureInput).toHaveCSS("background-color", "rgba(16, 17, 18, 0.55)");
  await expect(panel).toHaveCSS("backdrop-filter", "blur(0px)");
});
