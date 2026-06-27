import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

async function hoverCenter(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2, { steps: 5 });
  await page.waitForTimeout(100);
}

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

test("renders concurrent panels without duplicate input ids", async ({ page }) => {
  await expect(page.getByTestId("tweaker-panel")).toBeVisible();
  await expect(page.getByTestId("tweaker-panel-build")).toBeVisible();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const ids = Array.from(document.querySelectorAll<HTMLElement>(".tw-panel [id]")).map(
          (element) => element.id,
        );
        return ids.length === new Set(ids).size;
      }),
    )
    .toBe(true);
});

test("keeps panel collapse state independent", async ({ page }) => {
  await page.getByRole("button", { name: "Collapse Build" }).click();

  await expect(page.getByRole("combobox", { name: "Channel" })).toBeHidden();
  await expect(page.getByRole("slider", { name: "Speed" })).toBeVisible();

  await page.reload();

  await expect(page.getByRole("button", { name: "Expand Build" })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Speed" })).toBeVisible();
});

test("updates and persists a custom color control", async ({ page }) => {
  const color = page.locator("input[type='color']");

  await color.fill("#ff0000");
  await expect(page.getByText("Accent #ff0000")).toBeVisible();

  await page.reload();

  await expect(page.locator("input[type='color']")).toHaveValue("#ff0000");
  await expect(page.getByText("Accent #ff0000")).toBeVisible();
});

test("programmatic setter updates the panel and preview", async ({ page }) => {
  await page.getByRole("button", { name: "Set speed to 1.25" }).click();

  await expect(page.getByText("Speed 1.25")).toBeVisible();
  await expect(page.getByRole("group", { name: "Speed" }).getByRole("slider")).toHaveValue("1.25");
});

test("renders info, alert, and error control status states", async ({ page }) => {
  const speed = page.getByTestId("control-speed");
  const exposure = page.getByTestId("control-exposure");
  const bloom = page.getByTestId("control-bloom");

  await expect(speed).toHaveAttribute("data-status", "info");
  await expect(speed).toHaveCSS("background-color", "rgba(59, 130, 246, 0.1)");
  await expect(speed).toHaveCSS("border-left-width", "3px");
  await expect(speed).toHaveCSS("outline-color", "rgba(96, 165, 250, 0.22)");

  await expect(exposure).toHaveAttribute("data-status", "alert");
  await expect(exposure).toHaveCSS("background-color", "rgba(245, 158, 11, 0.11)");
  await expect(exposure).toHaveCSS("border-left-width", "3px");
  await expect(exposure).toHaveCSS("outline-color", "rgba(251, 191, 36, 0.24)");

  await expect(bloom).toHaveAttribute("data-status", "error");
  await expect(bloom).toHaveCSS("background-color", "rgba(239, 68, 68, 0.1)");
  await expect(bloom).toHaveCSS("border-left-width", "3px");
  await expect(bloom).toHaveCSS("outline-color", "rgba(248, 113, 113, 0.24)");
});

test("shows control help tooltips with panel styling", async ({ page }) => {
  const help = page.getByRole("button", { name: "Help for Speed" });

  await hoverCenter(page, help);

  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toContainText("Adjusts the preview animation speed.");
  await expect(tooltip).toHaveAttribute("data-theme", "dark");
  await expect(tooltip).toHaveCSS("background-color", "rgba(29, 31, 32, 0.95)");
  await expect(tooltip).toHaveCSS("backdrop-filter", "blur(8px)");
});

test("applies light panel theme to control help tooltips", async ({ page }) => {
  await page.goto("/?theme=light");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await hoverCenter(page, page.getByRole("button", { name: "Help for Tint" }));

  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toContainText("Changes the material color palette.");
  await expect(tooltip).toHaveAttribute("data-theme", "light");
  await expect(tooltip).toHaveCSS("background-color", "rgba(255, 255, 252, 0.95)");
});

test("collapses and persists panel state", async ({ page }) => {
  await page.getByRole("button", { name: "Collapse Scene" }).click();

  await expect(page.getByRole("slider", { name: "Speed" })).toBeHidden();
  await page.reload();
  await expect(page.getByRole("button", { name: "Expand Scene" })).toBeVisible();
  await expect(
    page.getByTestId("tweaker-panel-build").getByTestId("control-channel"),
  ).toBeVisible();
});

test("resets values separately from order", async ({ page }) => {
  await page.getByRole("textbox", { name: "Exposure" }).fill("3");
  await page.getByRole("textbox", { name: "Exposure" }).press("Enter");
  await page.getByTestId("control-channel").locator(".tw-select__button").click();
  await page.getByRole("option", { name: "Canary" }).click();
  await page.getByRole("button", { name: "Reset Scene values" }).click();

  await expect(page.getByRole("textbox", { name: "Exposure" })).toHaveValue("1");
  await expect(page.getByTestId("control-channel").locator(".tw-select__button")).toContainText(
    "Canary",
  );
});

test("docks the panel near a viewport edge", async ({ page }) => {
  const header = page.getByTestId("tweaker-panel").locator(".tw-panel__header");
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
        return raw ? JSON.parse(raw).state?.panels?.default?.dock?.edge : null;
      }),
    )
    .toBe("left");
});

test("docks the panel to a corner when two viewport edges are near", async ({ page }) => {
  const header = page.getByTestId("tweaker-panel").locator(".tw-panel__header");
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
        const dock = raw ? JSON.parse(raw).state?.panels?.default?.dock : null;
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
  const header = page.getByTestId("tweaker-panel").locator(".tw-panel__header");
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
        return raw ? (JSON.parse(raw).state?.panels?.default?.dock ?? null) : "missing";
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
        return raw ? (JSON.parse(raw).state?.order?.default?.rendering ?? []) : [];
      }),
    )
    .toContain("docs-demo:default:rendering:speed");
});

test("keeps panel appearance active during row pointer interaction without hover or focus", async ({
  page,
}) => {
  const panel = page.getByTestId("tweaker-panel");
  const speedGrip = page.getByRole("button", { name: "Reorder Speed" });
  const outsideButton = page.getByRole("button", { name: "Set speed to 1.25" });
  const speedBox = await speedGrip.boundingBox();
  expect(speedBox).not.toBeNull();

  await outsideButton.focus();
  await page.mouse.move(20, 20);
  await expect(panel).toHaveCSS("background-color", "rgba(21, 22, 23, 0.55)");
  await expect
    .poll(() =>
      panel.evaluate((element) => ({
        focusedWithin: element.matches(":focus-within"),
        hovered: element.matches(":hover"),
      })),
    )
    .toEqual({ focusedWithin: false, hovered: false });

  await speedGrip.dispatchEvent("pointerdown", {
    bubbles: true,
    button: 0,
    buttons: 1,
    cancelable: true,
    clientX: speedBox!.x + speedBox!.width / 2,
    clientY: speedBox!.y + speedBox!.height / 2,
    isPrimary: true,
    pointerId: 41,
    pointerType: "touch",
  });
  await speedGrip.dispatchEvent("pointermove", {
    bubbles: true,
    button: 0,
    buttons: 1,
    cancelable: true,
    clientX: 20,
    clientY: 20,
    isPrimary: true,
    pointerId: 41,
    pointerType: "touch",
  });

  await expect
    .poll(() =>
      panel.evaluate((element) => ({
        active: element.getAttribute("data-active"),
        focusedWithin: element.matches(":focus-within"),
        hovered: element.matches(":hover"),
      })),
    )
    .toEqual({ active: "true", focusedWithin: false, hovered: false });
  await expect(panel).toHaveCSS("background-color", "rgba(21, 22, 23, 0.95)");

  await speedGrip.dispatchEvent("pointerup", {
    bubbles: true,
    button: 0,
    buttons: 0,
    cancelable: true,
    clientX: 20,
    clientY: 20,
    isPrimary: true,
    pointerId: 41,
    pointerType: "touch",
  });

  await expect
    .poll(() => panel.evaluate((element) => element.getAttribute("data-active")))
    .toBeNull();
  await expect(panel).toHaveCSS("background-color", "rgba(21, 22, 23, 0.55)");
});

test("does not move controls between sections by pointer-dragging the grip", async ({ page }) => {
  const tintGrip = page.getByRole("button", { name: "Reorder Tint" });
  const speedRow = page.getByTestId("control-speed");
  const tintBox = await tintGrip.boundingBox();
  const speedBox = await speedRow.boundingBox();
  expect(tintBox).not.toBeNull();
  expect(speedBox).not.toBeNull();

  await page.mouse.move(tintBox!.x + tintBox!.width / 2, tintBox!.y + tintBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(Math.max(4, speedBox!.x - 32), 8, { steps: 12 });
  await page.mouse.up();

  await expect
    .poll(async () =>
      page.evaluate(() =>
        Array.from(
          document.querySelectorAll("[data-testid='section-Material'] [data-control-id]"),
        ).map((row) => row.getAttribute("data-control-id")),
      ),
    )
    .toEqual([
      "docs-demo:default:material:shape",
      "docs-demo:default:material:tint",
      "docs-demo:default:material:roughness",
      "docs-demo:default:material:accent",
    ]);
  await expect
    .poll(async () =>
      page.evaluate(() =>
        Array.from(
          document.querySelectorAll("[data-testid='section-Rendering'] [data-control-id]"),
        ).map((row) => row.getAttribute("data-control-id")),
      ),
    )
    .toEqual([
      "docs-demo:default:rendering:speed",
      "docs-demo:default:rendering:exposure",
      "docs-demo:default:rendering:bloom",
    ]);
});

test("reorders controls within a section by keyboard on the grip", async ({ page }) => {
  const speedGrip = page.getByRole("button", { name: "Reorder Speed" });
  await speedGrip.focus();
  await page.keyboard.press("ArrowDown");

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const raw = localStorage.getItem("tweaker:docs-demo");
        return raw ? (JSON.parse(raw).state?.order?.default?.rendering ?? []) : [];
      }),
    )
    .toContain("docs-demo:default:rendering:speed");
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
        return raw ? (JSON.parse(raw).state?.order?.build?.build ?? []) : [];
      }),
    )
    .toEqual([]);
});

test("applies panel appearance with hover transitions", async ({ page }) => {
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
  await expect(popover).toHaveAttribute("data-theme", "dark");
  await expect(popover).toHaveCSS("background-color", "rgba(29, 31, 32, 0.95)");
  await expect(popover).toHaveCSS("backdrop-filter", "blur(8px)");
});

test("keeps panel appearance active while a portaled select is open", async ({ page }) => {
  const panel = page.getByTestId("tweaker-panel");

  await expect(panel).toHaveCSS("background-color", "rgba(21, 22, 23, 0.55)");
  await page.getByTestId("control-tint").locator(".tw-select__button").click();

  const popover = page.locator(".tw-select__popover");
  await expect(popover).toBeVisible();
  const popoverBox = await popover.boundingBox();
  expect(popoverBox).not.toBeNull();

  await page.mouse.move(
    popoverBox!.x + popoverBox!.width / 2,
    popoverBox!.y + Math.min(16, popoverBox!.height / 2),
  );

  await expect
    .poll(() =>
      panel.evaluate((element) => ({
        active: element.getAttribute("data-active"),
        focusedWithin: element.matches(":focus-within"),
        hovered: element.matches(":hover"),
      })),
    )
    .toEqual({ active: "true", focusedWithin: false, hovered: false });
  await expect(panel).toHaveCSS("background-color", "rgba(21, 22, 23, 0.95)");
  await expect(panel).toHaveCSS("backdrop-filter", "blur(8px)");

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Set speed to 1.25" }).click();

  await expect(popover).toBeHidden();
  await expect(panel).toHaveCSS("background-color", "rgba(21, 22, 23, 0.55)");
  await expect(panel).toHaveCSS("backdrop-filter", "blur(0px)");
});

test("applies light panel theme to controls and portaled select popovers", async ({ page }) => {
  await page.goto("/?theme=light");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const panel = page.getByTestId("tweaker-panel");
  const exposureInput = page.getByRole("textbox", { name: "Exposure" });

  await expect(panel).toHaveAttribute("data-theme", "light");
  await expect(panel).toHaveCSS("background-color", "rgba(248, 250, 246, 0.55)");
  await expect(exposureInput).toHaveCSS("background-color", "rgba(237, 242, 235, 0.55)");

  await panel.hover();
  await page.getByTestId("control-tint").locator(".tw-select__button").click();

  const popover = page.locator(".tw-select__popover");
  await expect(popover).toHaveAttribute("data-theme", "light");
  await expect(popover).toHaveCSS("background-color", "rgba(255, 255, 252, 0.95)");
});

test("switches panel themes from the docs page", async ({ page }) => {
  const panel = page.getByTestId("tweaker-panel");
  const lightButton = page.getByRole("button", { name: "Light" });
  const darkButton = page.getByRole("button", { name: "Dark" });
  const systemButton = page.getByRole("button", { name: "System" });

  await expect(darkButton).toHaveAttribute("aria-pressed", "true");
  await lightButton.click();
  await expect(lightButton).toHaveAttribute("aria-pressed", "true");
  await expect(panel).toHaveAttribute("data-theme", "light");
  await expect(panel).toHaveCSS("background-color", "rgba(248, 250, 246, 0.55)");
  await expect(page).toHaveURL(/theme=light/);

  await systemButton.click();
  await expect(systemButton).toHaveAttribute("aria-pressed", "true");
  await expect(panel).toHaveAttribute("data-theme", "system");
  await expect(page).toHaveURL(/theme=system/);

  await darkButton.click();
  await expect(darkButton).toHaveAttribute("aria-pressed", "true");
  await expect(panel).toHaveAttribute("data-theme", "dark");
  await expect(page).not.toHaveURL(/theme=/);
});

test("uses light colors for system theme when the OS preference is light", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/?theme=system");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const panel = page.getByTestId("tweaker-panel");

  await expect(panel).toHaveAttribute("data-theme", "system");
  await expect(panel).toHaveCSS("background-color", "rgba(248, 250, 246, 0.55)");
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

test("updates panel appearance from runtime state", async ({ page }) => {
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
