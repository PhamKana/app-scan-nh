import { test } from "node:test";
import assert from "node:assert/strict";
import { fullQuad, validQuad, rotateQuad, fitA4 } from "../public/geometry.mjs";
test("full image and perspective quadrilateral are valid", () => {
  assert.ok(validQuad(fullQuad(900, 1200), 900, 1200));
  assert.ok(
    validQuad(
      [
        { x: 100, y: 50 },
        { x: 780, y: 140 },
        { x: 850, y: 1000 },
        { x: 50, y: 1100 },
      ],
      900,
      1200,
    ),
  );
});
test("crossing, concave, tiny, and out of bounds selections are rejected", () => {
  const q = fullQuad(900, 1200);
  assert.equal(validQuad([q[0], q[2], q[1], q[3]], 900, 1200), false);
  assert.equal(
    validQuad([q[0], q[1], { x: 50, y: 50 }, q[3]], 900, 1200),
    false,
  );
  assert.equal(validQuad(fullQuad(5, 5), 900, 1200), false);
  assert.equal(validQuad([{ x: -1, y: 0 }, ...q.slice(1)], 900, 1200), false);
});
test("four rotations return exact image-space corners", () => {
  const q = [
    { x: 100, y: 50 },
    { x: 780, y: 140 },
    { x: 850, y: 1000 },
    { x: 50, y: 1100 },
  ];
  let p = q,
    w = 900,
    h = 1200;
  for (let i = 0; i < 4; i++) {
    p = rotateQuad(p, h);
    [w, h] = [h, w];
    assert.ok(validQuad(p, w, h));
  }
  assert.deepEqual(p, q);
});
test("A4 fitting preserves aspect ratio and centers landscape and portrait", () => {
  for (const [w, h] of [
    [2000, 1000],
    [900, 1800],
    [1000, 1000],
  ]) {
    const f = fitA4(w, h);
    assert.ok(Math.abs(f.width / f.height - w / h) < 1e-10);
    assert.ok(f.x >= 10 && f.y >= 10);
    assert.equal(f.landscape, w > h);
    assert.ok(Math.abs(f.x * 2 + f.width - (f.landscape ? 297 : 210)) < 1e-10);
  }
});
