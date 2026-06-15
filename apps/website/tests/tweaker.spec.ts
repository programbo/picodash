import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("updates controls and persists values", async ({ page }) => {
  await page.getByRole("textbox", { name: "Exposure" }).fill("2.5");
  await page.getByRole("textbox", { name: "Exposure" }).press("Enter");
  await page.getByTestId("control-bloom").locator(".tw-checkbox").click();
  await page.getByTestId("control-tint").locator(".tw-select__button").click();
  await page.getByRole("option", { name: "Amber" }).click();

  await expect(page.getByText("Exposure 2.5")).toBeVisible();
  await expect(page.locator(".preview__object")).not.toHaveClass(/has-bloom/);

  await page.reload();

  await expect(page.getByRole("textbox", { name: "Exposure" })).toHaveValue("2.5");
  await expect(page.getByRole("checkbox", { name: "Bloom" })).not.toBeChecked();
  await expect(page.getByTestId("control-tint").locator(".tw-select__button")).toContainText(
    "Amber",
  );
});

test("programmatic setter updates the panel and preview", async ({ page }) => {
  await page.getByRole("button", { name: "Set speed to 1.25" }).click();

  await expect(page.getByText("Speed 1.25")).toBeVisible();
  await expect(page.getByRole("group", { name: "Speed" }).getByRole("slider")).toHaveValue("1.25");
});

test("shows rich control tooltips from label helper icons", async ({ page }) => {
  const inlineGap = await page.getByTestId("control-speed").evaluate((row) => {
    const text = row.querySelector(".tw-row__label-text");
    const trigger = row.querySelector(".tw-tooltip-trigger");
    if (!text || !trigger) return null;
    return Math.round(trigger.getBoundingClientRect().left - text.getBoundingClientRect().right);
  });
  expect(inlineGap).not.toBeNull();
  expect(inlineGap).toBeLessThanOrEqual(5);

  await page.getByRole("button", { name: "About Speed" }).focus();

  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toContainText("Animation speed");
  await expect(tooltip).toContainText("Higher values shorten the preview loop duration.");
  await expect(tooltip.locator(".tw-tooltip__content")).toHaveCSS("color", "rgb(213, 244, 255)");
});

test("keeps panel effects active while hovering tooltip content", async ({ page }) => {
  const panel = page.getByTestId("tweaker-panel");
  const trigger = page.getByRole("button", { name: "About Speed" });
  const tooltip = page.getByRole("tooltip");

  await expect(panel).toHaveCSS("background-color", "rgba(21, 22, 23, 0.55)");
  await trigger.hover();
  await expect(tooltip).toBeVisible();
  await expect(panel).toHaveCSS("background-color", "rgba(21, 22, 23, 0.95)");

  const tooltipBox = await tooltip.boundingBox();
  expect(tooltipBox).not.toBeNull();
  await page.mouse.move(
    tooltipBox!.x + tooltipBox!.width / 2,
    tooltipBox!.y + tooltipBox!.height / 2,
  );

  await expect(tooltip).toBeVisible();
  await expect(panel).toHaveCSS("background-color", "rgba(21, 22, 23, 0.95)");
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

test("docks the panel to a corner when two viewport edges are near", async ({ page }) => {
  const header = page.locator(".tw-panel__header");
  const box = await header.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box!.x + 80, box!.y + 16);
  await page.mouse.down();
  await page.mouse.move(83, 20, { steps: 8 });
  await page.mouse.up();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const raw = localStorage.getItem("tweaker:docs-demo");
        const dock = raw ? JSON.parse(raw).state?.dock : null;
        return dock ? [dock.edge, dock.secondaryEdge] : null;
      }),
    )
    .toEqual(["left", "top"]);
});

test("keeps docked panels anchored when the viewport resizes", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem(
      "tweaker:docs-demo",
      JSON.stringify({
        state: {
          values: {},
          order: {},
          collapsed: false,
          dock: { edge: "right", offset: 80 },
        },
      }),
    );
  });
  await page.reload();

  await page.setViewportSize({ width: 980, height: 680 });
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const rect = document
          .querySelector("[data-testid='tweaker-panel']")!
          .getBoundingClientRect();
        return Math.round(window.innerWidth - rect.right);
      }),
    )
    .toBe(0);

  await page.setViewportSize({ width: 760, height: 560 });
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const rect = document
          .querySelector("[data-testid='tweaker-panel']")!
          .getBoundingClientRect();
        return Math.round(window.innerWidth - rect.right);
      }),
    )
    .toBe(0);

  await page.evaluate(() => {
    localStorage.setItem(
      "tweaker:docs-demo",
      JSON.stringify({
        state: {
          values: {},
          order: {},
          collapsed: false,
          dock: { edge: "right", secondaryEdge: "bottom", offset: 80 },
        },
      }),
    );
  });
  await page.reload();

  await page.setViewportSize({ width: 920, height: 700 });
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const rect = document
          .querySelector("[data-testid='tweaker-panel']")!
          .getBoundingClientRect();
        return [
          Math.round(window.innerWidth - rect.right),
          Math.round(window.innerHeight - rect.bottom),
        ];
      }),
    )
    .toEqual([0, 0]);
});

test("keeps floating panels inside the viewport when the viewport resizes", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  const header = page.locator(".tw-panel__header");
  const box = await header.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box!.x + 80, box!.y + 16);
  await page.mouse.down();
  await page.mouse.move(820, 220, { steps: 8 });
  await page.mouse.up();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const raw = localStorage.getItem("tweaker:docs-demo");
        return raw ? JSON.parse(raw).state?.dock : "missing";
      }),
    )
    .toBeNull();

  await page.setViewportSize({ width: 500, height: 400 });

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const rect = document
          .querySelector("[data-testid='tweaker-panel']")!
          .getBoundingClientRect();
        return {
          bottomOverflow: Math.max(0, Math.round(rect.bottom - window.innerHeight)),
          rightOverflow: Math.max(0, Math.round(rect.right - window.innerWidth)),
        };
      }),
    )
    .toEqual({ bottomOverflow: 0, rightOverflow: 0 });
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

test("applies hook-level panel effects to portaled select popovers", async ({ page }) => {
  await page.getByTestId("control-tint").locator(".tw-select__button").click();

  const popover = page.locator(".tw-select__popover");
  await expect(popover).toHaveCSS("background-color", "rgba(29, 31, 32, 0.95)");
  await expect(popover).toHaveCSS("backdrop-filter", "blur(8px)");
});

test("applies hover panel effects while keyboard focus is inside the panel", async ({ page }) => {
  const panel = page.getByTestId("tweaker-panel");
  const exposureInput = page.getByRole("textbox", { name: "Exposure" });

  await expect(panel).toHaveCSS("opacity", "1");
  await expect(panel).toHaveCSS("background-color", "rgba(21, 22, 23, 0.55)");
  await expect(exposureInput).toHaveCSS("background-color", "rgba(16, 17, 18, 0.55)");
  await page.getByRole("group", { name: "Speed" }).getByRole("slider").focus();
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
