import assert from "node:assert/strict";
import test from "node:test";
import { getCropSourceRect } from "../app/crop.ts";

test("centers a cover crop at zoom 1", () => {
  const rect = getCropSourceRect(1600, 900, 1080, 1080, 1, 50, 50);
  assert.deepEqual(rect, { sx: 350, sy: 0, sw: 900, sh: 900 });
});

test("maps crop position to source edges", () => {
  const left = getCropSourceRect(1600, 900, 1080, 1080, 1, 0, 50);
  const right = getCropSourceRect(1600, 900, 1080, 1080, 1, 100, 50);
  assert.equal(left.sx, 0);
  assert.equal(right.sx, 700);
});

test("zooms around the selected source position", () => {
  const rect = getCropSourceRect(1600, 900, 1080, 1080, 2, 75, 25);
  assert.deepEqual(rect, { sx: 862.5, sy: 112.5, sw: 450, sh: 450 });
});

test("clamps zoom and crop position safely", () => {
  const rect = getCropSourceRect(800, 1200, 1080, 1920, 99, -20, 130);
  assert.ok(rect.sx >= 0 && rect.sy >= 0);
  assert.ok(rect.sw > 0 && rect.sh > 0);
  assert.ok(rect.sx + rect.sw <= 800);
  assert.ok(rect.sy + rect.sh <= 1200);
});
