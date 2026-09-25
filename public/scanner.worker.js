/* OpenCV stays in this worker; document pixels never leave the browser. */
let ready;
async function getCV() {
  if (!ready)
    ready = (async () => {
      importScripts("/opencv.js");
      let cv = self.cv;
      // Emscripten exposes a self-resolving thenable, not a native Promise.
      // Resolve a wrapper to avoid infinite Promise assimilation of cv.then.
      if (cv && typeof cv.then === "function") {
        const loaded = await new Promise((resolve) =>
          cv.then((value) => resolve({ cv: value })),
        );
        cv = loaded.cv;
      }
      if (!cv?.Mat)
        await new Promise((resolve, reject) => {
          const start = Date.now();
          const timer = setInterval(() => {
            if (self.cv?.Mat) {
              clearInterval(timer);
              resolve();
            } else if (Date.now() - start > 60000) {
              clearInterval(timer);
              reject(Error("timeout"));
            }
          }, 50);
        });
      return { cv: cv?.Mat ? cv : self.cv };
    })().catch(() => {
      ready = null;
      throw Error("Không tải được OpenCV. Kiểm tra kết nối rồi bấm Thử lại.");
    });
  return ready;
}
function ordered(points) {
  const center = points.reduce(
    (s, p) => ({ x: s.x + p.x / 4, y: s.y + p.y / 4 }),
    { x: 0, y: 0 },
  );
  points.sort(
    (a, b) =>
      Math.atan2(a.y - center.y, a.x - center.x) -
      Math.atan2(b.y - center.y, b.x - center.x),
  );
  let first = 0;
  for (let i = 1; i < 4; i++)
    if (points[i].x + points[i].y < points[first].x + points[first].y)
      first = i;
  return [...points.slice(first), ...points.slice(0, first)];
}
async function run({
  id,
  blob,
  action,
  rotation,
  corners,
  colorMode = "original",
}) {
  const { fullQuad, validQuad } = await import("/geometry.mjs");
  const { cv } = await getCV();
  const bitmap = await createImageBitmap(blob);
  const swap = rotation % 180 !== 0;
  const w = swap ? bitmap.height : bitmap.width,
    h = swap ? bitmap.width : bitmap.height;
  const canvas = new OffscreenCanvas(w, h),
    ctx = canvas.getContext("2d");
  ctx.translate(w / 2, h / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close();
  const mats = [];
  const keep = (m) => {
    mats.push(m);
    return m;
  };
  try {
    let detected = !!corners;
    if (!corners) {
      const scale = Math.min(1, 1000 / Math.max(w, h));
      const small = new OffscreenCanvas(
        Math.round(w * scale),
        Math.round(h * scale),
      );
      const sc = small.getContext("2d");
      sc.drawImage(canvas, 0, 0, small.width, small.height);
      const src = keep(
          cv.matFromImageData(sc.getImageData(0, 0, small.width, small.height)),
        ),
        gray = keep(new cv.Mat()),
        edges = keep(new cv.Mat()),
        contours = keep(new cv.MatVector()),
        hierarchy = keep(new cv.Mat()),
        kernel = keep(cv.Mat.ones(3, 3, cv.CV_8U));
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
      cv.Canny(gray, edges, 45, 135);
      cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
      cv.findContours(
        edges,
        contours,
        hierarchy,
        cv.RETR_LIST,
        cv.CHAIN_APPROX_SIMPLE,
      );
      let best = 0;
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i),
          approx = new cv.Mat();
        try {
          cv.approxPolyDP(
            contour,
            approx,
            0.02 * cv.arcLength(contour, true),
            true,
          );
          const area = Math.abs(cv.contourArea(approx));
          if (
            approx.rows !== 4 ||
            !cv.isContourConvex(approx) ||
            area < small.width * small.height * 0.18 ||
            area <= best
          )
            continue;
          const p = ordered(
            Array.from({ length: 4 }, (_, j) => ({
              x: (approx.data32S[j * 2] * w) / small.width,
              y: (approx.data32S[j * 2 + 1] * h) / small.height,
            })),
          );
          if (!validQuad(p, w, h)) continue;
          const lengths = p.map((a, j) =>
            Math.hypot(a.x - p[(j + 1) % 4].x, a.y - p[(j + 1) % 4].y),
          );
          if (Math.max(...lengths) / Math.min(...lengths) > 6) continue;
          best = area;
          corners = p;
        } finally {
          contour.delete();
          approx.delete();
        }
      }
      detected = !!corners;
      corners = corners || fullQuad(w, h);
      small.width = small.height = 0;
    }
    if (!validQuad(corners, w, h))
      throw Error("Vùng scan không hợp lệ. Hãy chọn lại bốn góc.");
    if (action === "detect") {
      self.postMessage({ id, width: w, height: h, corners, detected });
      return;
    }
    let output = canvas;
    if (detected) {
      const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const ow = Math.max(
          2,
          Math.round(
            Math.max(
              dist(corners[0], corners[1]),
              dist(corners[3], corners[2]),
            ),
          ),
        ),
        oh = Math.max(
          2,
          Math.round(
            Math.max(
              dist(corners[0], corners[3]),
              dist(corners[1], corners[2]),
            ),
          ),
        );
      const scale = Math.min(1, 2600 / Math.max(ow, oh));
      const dw = Math.round(ow * scale),
        dh = Math.round(oh * scale);
      const src = keep(cv.matFromImageData(ctx.getImageData(0, 0, w, h))),
        dst = keep(new cv.Mat()),
        from = keep(
          cv.matFromArray(
            4,
            1,
            cv.CV_32FC2,
            corners.flatMap((p) => [p.x, p.y]),
          ),
        ),
        to = keep(
          cv.matFromArray(4, 1, cv.CV_32FC2, [
            0,
            0,
            dw - 1,
            0,
            dw - 1,
            dh - 1,
            0,
            dh - 1,
          ]),
        ),
        matrix = keep(cv.getPerspectiveTransform(from, to));
      cv.warpPerspective(
        src,
        dst,
        matrix,
        new cv.Size(dw, dh),
        cv.INTER_LINEAR,
        cv.BORDER_REPLICATE,
      );
      output = new OffscreenCanvas(dw, dh);
      output
        .getContext("2d")
        .putImageData(
          new ImageData(new Uint8ClampedArray(dst.data), dw, dh),
          0,
          0,
        );
    }
    if (colorMode === "paper") {
      const oc = output.getContext("2d");
      const pixels = oc.getImageData(0, 0, output.width, output.height);
      const src = keep(cv.matFromImageData(pixels));
      const gray = keep(new cv.Mat());
      const background = keep(new cv.Mat());
      const size = Math.max(
        15,
        Math.round(Math.min(output.width, output.height) / 35) | 1,
      );
      const kernel = keep(
        cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(size, size)),
      );
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      // Close small dark strokes to estimate the paper illumination locally.
      cv.morphologyEx(gray, background, cv.MORPH_CLOSE, kernel);
      cv.GaussianBlur(background, background, new cv.Size(size, size), 0);
      const data = pixels.data;
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2];
        const light = Math.max(40, background.data[p]);
        const ratio = gray.data[p] / light;
        const tone = Math.max(0, Math.min(1, (ratio - 0.38) / 0.55));
        const neutral = Math.round(255 * tone * tone * (3 - 2 * tone));
        // Keep red/pink stamp ink and blue/navy pen ink, including soft edges.
        const red = Math.min(r - g, r - b);
        const blue = Math.min(b - r, (b - g) * 1.5);
        const ink = Math.max(0, Math.min(1, (Math.max(red, blue) - 10) / 30));
        const gain = Math.min(1.8, 255 / light);
        data[i] = neutral * (1 - ink) + Math.min(255, r * gain) * ink;
        data[i + 1] = neutral * (1 - ink) + Math.min(255, g * gain) * ink;
        data[i + 2] = neutral * (1 - ink) + Math.min(255, b * gain) * ink;
      }
      oc.putImageData(pixels, 0, 0);
    }
    const result = await output.convertToBlob({
      type: "image/jpeg",
      quality: 0.94,
    });
    self.postMessage({
      id,
      blob: result,
      width: output.width,
      height: output.height,
      corners,
      detected,
    });
    if (output !== canvas) output.width = output.height = 0;
  } finally {
    mats.reverse().forEach((m) => m.delete());
    canvas.width = canvas.height = 0;
  }
}
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue
    .then(() => run(data))
    .catch((e) =>
      self.postMessage({
        id: data.id,
        error:
          typeof e.message === "string"
            ? e.message
            : "Không xử lý được ảnh. Hãy thử lại hoặc chọn ảnh nhỏ hơn.",
      }),
    );
};
