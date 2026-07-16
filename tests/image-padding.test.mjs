import assert from "node:assert/strict";
import test from "node:test";
import { padImageBytes } from "../app/image-padding.ts";

function minimalPng() {
  return new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10,
    0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
  ]);
}

test("pads JPEG with legal COM segments before EOI", () => {
  const input = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const output = padImageBytes(input, "jpeg", 90_001);
  assert.equal(output.length, 90_001);
  assert.deepEqual([...output.subarray(-2)], [0xff, 0xd9]);
  assert.equal(output[2], 0xff);
  assert.equal(output[3], 0xfe);
});

test("pads PNG with a tEXt chunk before IEND", () => {
  const output = padImageBytes(minimalPng(), "png", 1_000);
  assert.equal(output.length, 1_000);
  assert.equal(new TextDecoder().decode(output.subarray(12, 16)), "tEXt");
  assert.equal(output[24], 0x20);
  assert.equal(new TextDecoder().decode(output.subarray(-8, -4)), "IEND");
});

test("pads WebP with an even RIFF JUNK chunk and updates RIFF size", () => {
  const input = new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80]);
  const output = padImageBytes(input, "webp", 1_001);
  assert.equal(output.length, 1_002);
  assert.equal(new TextDecoder().decode(output.subarray(12, 16)), "JUNK");
  assert.equal(new DataView(output.buffer).getUint32(4, true), output.length - 8);
});

test("returns a copy unchanged when target is not larger", () => {
  const input = minimalPng();
  const output = padImageBytes(input, "png", 10);
  assert.deepEqual(output, input);
  assert.notEqual(output, input);
});
