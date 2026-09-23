import type { Quad } from "./types";
let worker: Worker | undefined;
let serial = 0;
const pending = new Map<
  number,
  {
    resolve: (value: Result) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
type Result = {
  blob?: Blob;
  width: number;
  height: number;
  corners: Quad;
  detected: boolean;
};
export function resetWorker() {
  worker?.terminate();
  worker = undefined;
  for (const p of pending.values()) {
    clearTimeout(p.timer);
    p.reject(new Error("Bộ xử lý đã khởi động lại. Vui lòng thử lại."));
  }
  pending.clear();
}
export function processImage(
  blob: Blob,
  action: "detect" | "scan",
  rotation = 0,
  corners?: Quad,
): Promise<Result> {
  if (!worker) {
    worker = new Worker("/scanner.worker.js");
    worker.onmessage = ({ data }) => {
      const p = pending.get(data.id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.delete(data.id);
      data.error ? p.reject(new Error(data.error)) : p.resolve(data);
    };
    worker.onerror = () => resetWorker();
  }
  const id = ++serial;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resetWorker(), 90000);
    pending.set(id, { resolve, reject, timer });
    worker!.postMessage({ id, blob, action, rotation, corners });
  });
}
export async function decodeFile(file: File) {
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Ảnh vượt quá 20 MB. Hãy chọn ảnh nhỏ hơn.");
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  }).catch(() => {
    throw new Error("Không đọc được ảnh. Hãy lưu lại dưới dạng JPG hoặc PNG.");
  });
  try {
    if (bitmap.width * bitmap.height > 60000000)
      throw new Error("Ảnh vượt quá 60 megapixel. Hãy giảm kích thước ảnh.");
    const scale = Math.min(1, 2600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("Không đủ bộ nhớ để đọc ảnh.")),
        "image/png",
      ),
    );
    const result = { blob, width: canvas.width, height: canvas.height };
    canvas.width = canvas.height = 0;
    return result;
  } finally {
    bitmap.close();
  }
}
