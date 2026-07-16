import assert from "node:assert/strict";
import test from "node:test";
import { createZipBlob, crc32, safeZipName } from "../app/zip.ts";

test("crc32 matches the standard ZIP checksum vector", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("createZipBlob writes local files, central directory and safe UTF-8 names", async () => {
  const first = new TextEncoder().encode("first image");
  const second = new Uint8Array([1, 2, 3, 4]);
  const blob = await createZipBlob([
    { name: "封面?.jpg", data: first },
    { name: "album/two.png", data: second },
  ]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);

  assert.equal(blob.type, "application/zip");
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(bytes.length - 14, true), 2);
  assert.equal(view.getUint16(bytes.length - 12, true), 2);
  assert.equal(safeZipName("album/two.png"), "album-two.png");

  const decoded = new TextDecoder().decode(bytes);
  assert.match(decoded, /封面-.jpg/);
  assert.match(decoded, /album-two.png/);
});
