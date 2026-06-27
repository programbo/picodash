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
  await expect(page.getByRole("slider", { name: "Speed" })).toHaveValue("1.25");
});

test("collapses and persists panel state", async ({ page }) => {
  await page.getByRole("button", { name: "Collapse Scene" }).click();

  await expect(page.getByRole("slider", { name: "Speed" })).toBeHidden();
  await page.reload();
  await expect(page.getByRole("button", { name: "Expand Scene" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Channel" })).toBeVisible();
});

test("resets values separately from order", async ({ page }) => {
  await page.getByRole("textbox", { name: "Exposure" }).fill("3");
  await page.getByRole("textbox", { name: "Exposure" }).press("Enter");
  await page.getByRole("combobox", { name: "Channel" }).selectOption("canary");
  await page.getByRole("button", { name: "Reset Scene values" }).click();

  await expect(page.getByRole("textbox", { name: "Exposure" })).toHaveValue("1");
  await expect(page.getByRole("combobox", { name: "Channel" })).toHaveValue("canary");
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

test("does not move controls between sections by pointer-dragging the grip", async ({ page }) => {
  const roughnessGrip = page.getByRole("button", { name: "Reorder Roughness" });
  const speedRow = page.getByTestId("control-speed");
  const roughnessBox = await roughnessGrip.boundingBox();
  const speedBox = await speedRow.boundingBox();
  expect(roughnessBox).not.toBeNull();
  expect(speedBox).not.toBeNull();

  await page.mouse.move(
    roughnessBox!.x + roughnessBox!.width / 2,
    roughnessBox!.y + roughnessBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(speedBox!.x + speedBox!.width / 2, speedBox!.y + speedBox!.height / 2, {
    steps: 12,
  });
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
