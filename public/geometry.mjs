export function fullQuad(w, h) {
  return [
    { x: 0, y: 0 },
    { x: w - 1, y: 0 },
    { x: w - 1, y: h - 1 },
    { x: 0, y: h - 1 },
  ];
}
export function validQuad(p, w, h) {
  if (
    p.length !== 4 ||
    p.some(
      (v) =>
        !Number.isFinite(v.x) ||
        !Number.isFinite(v.y) ||
        v.x < 0 ||
        v.y < 0 ||
        v.x > w ||
        v.y > h,
    )
  )
    return false;
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = p[i],
      b = p[(i + 1) % 4],
      c = p[(i + 2) % 4];
    if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) <= 0)
      return false;
    if (Math.hypot(a.x - b.x, a.y - b.y) < Math.min(w, h) * 0.025) return false;
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2 > w * h * 0.015;
}
export function rotateQuad(p, h) {
  const q = p.map((v) => ({ x: h - 1 - v.y, y: v.x }));
  return [q[3], q[0], q[1], q[2]];
}
export function fitA4(w, h) {
  const landscape = w > h;
  const pw = landscape ? 297 : 210,
    ph = landscape ? 210 : 297;
  const s = Math.min((pw - 20) / w, (ph - 20) / h);
  return {
    landscape,
    x: (pw - w * s) / 2,
    y: (ph - h * s) / 2,
    width: w * s,
    height: h * s,
  };
}
