import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
async function fixture(page: import("@playwright/test").Page, blank = false) {
  return page.evaluate(async (blank) => {
    const c = document.createElement("canvas");
    c.width = 900;
    c.height = 700;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = blank ? "#cc4422" : "#253d44";
    ctx.fillRect(0, 0, 900, 700);
    if (!blank) {
      ctx.fillStyle = "#f6efdf";
      ctx.beginPath();
      ctx.moveTo(170, 70);
      ctx.lineTo(760, 130);
      ctx.lineTo(710, 620);
      ctx.lineTo(100, 560);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#de4038";
      ctx.fillRect(280, 240, 180, 160);
      ctx.fillStyle = "#2e9670";
      ctx.fillRect(490, 250, 100, 150);
    }
    return c.toDataURL("image/png").split(",")[1];
  }, blank);
}
test("real OpenCV detects tilted document, corrects perspective, preserves color and full-image fallback", async ({
  page,
}) => {
  await page.goto("/");
  const results = await page.evaluate(async () => {
    const worker = new Worker("/scanner.worker.js");
    let id = 0;
    const request = (blob: Blob, corners?: { x: number; y: number }[]) =>
      new Promise<any>((resolve, reject) => {
        worker.onmessage = (e) =>
          e.data.error ? reject(Error(e.data.error)) : resolve(e.data);
        worker.postMessage({
          id: ++id,
          blob,
          action: "scan",
          rotation: 0,
          corners,
        });
      });
    const c = new OffscreenCanvas(800, 600),
      ctx = c.getContext("2d")!;
    ctx.fillStyle = "#203040";
    ctx.fillRect(0, 0, 800, 600);
    const corners = [
      { x: 150, y: 70 },
      { x: 650, y: 110 },
      { x: 710, y: 530 },
      { x: 70, y: 490 },
    ];
    ctx.beginPath();
    corners.forEach((p, i) =>
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
    );
    ctx.closePath();
    ctx.fillStyle = "#e84430";
    ctx.fill();
    const source = await c.convertToBlob({ type: "image/png" });
    const auto = await request(source);
    const manual = await request(source, corners);
    const decoded = await createImageBitmap(manual.blob);
    const out = new OffscreenCanvas(decoded.width, decoded.height),
      oc = out.getContext("2d")!;
    oc.drawImage(decoded, 0, 0);
    const pixel = Array.from(
      oc.getImageData(
        Math.floor(decoded.width / 2),
        Math.floor(decoded.height / 2),
        1,
        1,
      ).data,
    );
    decoded.close();
    ctx.fillStyle = "#397bcc";
    ctx.fillRect(0, 0, 800, 600);
    const fallback = await request(
      await c.convertToBlob({ type: "image/png" }),
    );
    worker.terminate();
    return {
      auto: { detected: auto.detected, width: auto.width, height: auto.height },
      manual: { width: manual.width, height: manual.height, pixel },
      fallback: {
        detected: fallback.detected,
        width: fallback.width,
        height: fallback.height,
        corners: fallback.corners,
      },
    };
  });
  expect(results.auto.detected).toBe(true);
  expect(results.auto.width).toBeLessThan(800);
  expect(results.manual.width).toBe(641);
  expect(results.manual.height).toBe(428);
  expect(results.manual.pixel[0]).toBeGreaterThan(210);
  expect(results.manual.pixel[1]).toBeLessThan(90);
  expect(results.manual.pixel[2]).toBeLessThan(75);
  expect(results.fallback).toEqual({
    detected: false,
    width: 800,
    height: 600,
    corners: [
      { x: 0, y: 0 },
      { x: 799, y: 0 },
      { x: 799, y: 599 },
      { x: 0, y: 599 },
    ],
  });
});
test("normal editor supports independent corners, resize, rotation, cancel, order and PDF export", async ({
  page,
}) => {
  await page.goto("/");
  const img = await fixture(page);
  const second = await fixture(page, true);
  await page.getByRole("button", { name: /Scan bình thường/ }).click();
  await page.locator("input[type=file]").setInputFiles([
    {
      name: "trang-1.png",
      mimeType: "image/png",
      buffer: Buffer.from(img, "base64"),
    },
    {
      name: "trang-2.png",
      mimeType: "image/png",
      buffer: Buffer.from(second, "base64"),
    },
  ]);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const handles = dialog.locator(".corner");
  await expect(handles).toHaveCount(4);
  const before = await handles.evaluateAll((es) =>
    es.map((e) => e.getAttribute("style")),
  );
  await handles.nth(0).focus();
  await page.keyboard.press("ArrowRight");
  const after = await handles.evaluateAll((es) =>
    es.map((e) => e.getAttribute("style")),
  );
  expect(after[0]).not.toEqual(before[0]);
  expect(after.slice(1)).toEqual(before.slice(1));
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await handles.evaluateAll((es) => es.map((e) => e.getAttribute("style"))),
  ).toEqual(after);
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Xoay 90°" }).click();
  expect(
    await handles.evaluateAll((es) => es.map((e) => e.getAttribute("style"))),
  ).toEqual(after);
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(page.locator(".status.done")).toHaveCount(1);
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".status.done")).toHaveCount(2);
  const original = await page
    .locator(".thumbnail img")
    .first()
    .getAttribute("src");
  await page
    .getByRole("button", { name: "Chỉnh vùng scan", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Xoay 90°" }).click();
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  expect(await page.locator(".thumbnail img").first().getAttribute("src")).toBe(
    original,
  );
  await page.locator(".page-drag-handle").nth(1).scrollIntoViewIfNeeded();
  const dragStart = await page
    .locator(".page-drag-handle")
    .nth(1)
    .boundingBox();
  const dropEnd = await page.locator(".thumbnail").first().boundingBox();
  await page.mouse.move(dragStart!.x + 22, dragStart!.y + 22);
  await page.mouse.down();
  await page.mouse.move(dropEnd!.x + dropEnd!.width / 2, dropEnd!.y + 70, {
    steps: 12,
  });
  await expect(page.locator(".drop-target")).toHaveCount(1);
  await page.mouse.up();
  await expect(page.locator(".card-info h3").first()).toHaveText("trang-2.png");
  const expectedImages = await page
    .locator(".thumbnail img")
    .evaluateAll(async (images) =>
      Promise.all(
        images.map(async (image) => {
          const data = new Uint8Array(
            await (await fetch((image as HTMLImageElement).src)).arrayBuffer(),
          );
          return Array.from(data);
        }),
      ),
    );
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("tai-lieu.pdf");
  await download.saveAs("test-results/tai-lieu.pdf");
  const pdf = readFileSync("test-results/tai-lieu.pdf");
  const text = pdf.toString("latin1");
  expect(text).toContain("/Count 2");
  // jsPDF embeds the original JPEG bytes in gallery order, without re-encoding.
  const firstImage = pdf.indexOf(Buffer.from(expectedImages[0]));
  const secondImage = pdf.indexOf(Buffer.from(expectedImages[1]));
  expect(firstImage).toBeGreaterThan(0);
  expect(secondImage).toBeGreaterThan(firstImage);
  const objects = [...text.matchAll(/(\d+) 0 obj\s*([\s\S]*?)endobj/g)];
  const pageObjects = objects.filter((o) => /\/Type \/Page\s/.test(o[2]));
  expect(pageObjects).toHaveLength(2);
  for (let i = 0; i < pageObjects.length; i++) {
    const contentId = /\/Contents (\d+) 0 R/.exec(pageObjects[i][2])![1];
    const content = objects.find((o) => o[1] === contentId)![2];
    const stream = /stream\r?\n([\s\S]*?)\r?\nendstream/.exec(content)![1];
    const operators = inflateSync(Buffer.from(stream, "latin1")).toString();
    expect(operators).toContain(`/I${i} Do`);
  }
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
test("quick scan fallback and JPG download, OpenCV failure is retryable", async ({
  page,
}) => {
  await page.goto("/");
  const img = await fixture(page, true);
  await page.route("**/opencv.js", (route) => route.abort());
  await page.locator("input[type=file]").setInputFiles({
    name: "mau.png",
    mimeType: "image/png",
    buffer: Buffer.from(img, "base64"),
  });
  await expect(
    page.getByText("Không tải được OpenCV.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Tải JPG" })).toBeDisabled();
  await page.unroute("**/opencv.js");
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(
    page.getByText("Không tìm thấy viền tài liệu. Đã giữ toàn bộ ảnh."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Tải JPG" })).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải JPG" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("tai-lieu.jpg");
});
test("desktop empty state is responsive", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/");
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("corrupt image remains removable and blocks export", async ({ page }) => {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles({
    name: "hong.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await expect(
    page.getByText("Không đọc được ảnh.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Tải JPG" })).toBeDisabled();
  await page.getByRole("button", { name: "Xóa trang 1" }).click();
  await expect(page.locator(".page-card")).toHaveCount(0);
});

test("touch reorder inserts across pages; cancellation and keyboard preserve usable controls", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("http://localhost:3000");
  const img = await fixture(page, true);
  await page
    .locator("input[type=file]")
    .setInputFiles(
      [1, 2, 3].map((n) => ({
        name: `trang-${n}.png`,
        mimeType: "image/png",
        buffer: Buffer.from(img, "base64"),
      })),
    );
  await expect(page.locator(".status.done")).toHaveCount(3);
  const titles = page.locator(".card-info h3");
  await page.locator(".page-drag-handle").first().scrollIntoViewIfNeeded();
  const start = await page.locator(".page-drag-handle").first().boundingBox();
  const end = await page.locator(".thumbnail").nth(1).boundingBox();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: start!.x + 22, y: start!.y + 22 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: end!.x + end!.width / 2, y: end!.y + 80 }],
  });
  await expect(page.locator(".drop-target")).toHaveCount(1);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(titles).toHaveText([
    "trang-2.png",
    "trang-1.png",
    "trang-3.png",
  ]);
  // Keyboard moves are also available from the same handle.
  await page.locator(".page-drag-handle").nth(1).focus();
  await page.keyboard.press("ArrowRight");
  await expect(titles).toHaveText([
    "trang-2.png",
    "trang-3.png",
    "trang-1.png",
  ]);
  await page.locator(".page-drag-handle").first().scrollIntoViewIfNeeded();
  const handle = await page.locator(".page-drag-handle").first().boundingBox();
  const target = await page.locator(".thumbnail").nth(1).boundingBox();
  await page.mouse.move(handle!.x + 22, handle!.y + 22);
  await page.mouse.down();
  await page.mouse.move(target!.x + target!.width / 2, target!.y + 80, {
    steps: 8,
  });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(titles).toHaveText([
    "trang-2.png",
    "trang-3.png",
    "trang-1.png",
  ]);
  await expect(page.locator(".is-dragging")).toHaveCount(0);
  await context.close();
});
