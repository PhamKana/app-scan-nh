import type { Page } from "./types";
import { fitA4 } from "../public/geometry.mjs";
function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function exportPages(pages: Page[]) {
  if (!pages.length || pages.some((p) => p.status !== "done" || !p.result))
    throw Error("Hãy xử lý hoặc xóa các ảnh chưa hoàn tất trước khi tải.");
  if (pages.length === 1) {
    save(pages[0].result!, "tai-lieu.jpg");
    return;
  }
  const { jsPDF } = await import("jspdf");
  let pdf: InstanceType<typeof jsPDF> | undefined;
  for (const page of pages) {
    const bitmap = await createImageBitmap(page.result!);
    const fit = fitA4(bitmap.width, bitmap.height);
    bitmap.close();
    const orientation = fit.landscape ? "landscape" : "portrait";
    if (!pdf)
      pdf = new jsPDF({
        orientation,
        unit: "mm",
        format: "a4",
        compress: true,
      });
    else pdf.addPage("a4", orientation);
    pdf.addImage(
      new Uint8Array(await page.result!.arrayBuffer()),
      "JPEG",
      fit.x,
      fit.y,
      fit.width,
      fit.height,
    );
    await new Promise((r) => setTimeout(r, 0));
  }
  save(pdf!.output("blob"), "tai-lieu.pdf");
}
