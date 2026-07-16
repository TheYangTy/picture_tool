export type PaddedImageFormat = "jpeg" | "png" | "webp";

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const textEncoder = new TextEncoder();

function concatBytes(parts: Uint8Array[]) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function matches(bytes: Uint8Array, offset: number, expected: Uint8Array) {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const value of bytes) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function padJpeg(input: Uint8Array, targetBytes: number) {
  if (input[0] !== 0xff || input[1] !== 0xd8) throw new Error("不是有效的 JPEG 文件");
  let endMarker = -1;
  for (let index = input.length - 2; index >= 0; index -= 1) {
    if (input[index] === 0xff && input[index + 1] === 0xd9) {
      endMarker = index;
      break;
    }
  }
  if (endMarker < 0) throw new Error("JPEG 缺少结束标记");

  const chunks: Uint8Array[] = [];
  let added = 0;
  while (input.length + added < targetBytes) {
    const remaining = targetBytes - input.length - added;
    let chunkLength = remaining < 4 ? 4 : Math.min(65_537, remaining);
    const nextRemaining = remaining - chunkLength;
    if (nextRemaining > 0 && nextRemaining < 4) chunkLength -= 4 - nextRemaining;
    const payloadLength = chunkLength - 4;
    const segmentLength = payloadLength + 2;
    const chunk = new Uint8Array(chunkLength);
    chunk[0] = 0xff;
    chunk[1] = 0xfe;
    chunk[2] = (segmentLength >>> 8) & 255;
    chunk[3] = segmentLength & 255;
    chunks.push(chunk);
    added += chunk.length;
  }

  return concatBytes([input.subarray(0, endMarker), ...chunks, input.subarray(endMarker)]);
}

function findPngIend(input: Uint8Array) {
  if (!matches(input, 0, PNG_SIGNATURE)) throw new Error("不是有效的 PNG 文件");
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  let offset = 8;
  while (offset + 12 <= input.length) {
    const dataLength = view.getUint32(offset, false);
    const type = String.fromCharCode(...input.subarray(offset + 4, offset + 8));
    if (type === "IEND") return offset;
    offset += 12 + dataLength;
  }
  throw new Error("PNG 缺少 IEND 数据块");
}

function padPng(input: Uint8Array, targetBytes: number) {
  const iendOffset = findPngIend(input);
  const remaining = targetBytes - input.length;
  const totalChunkLength = Math.max(20, remaining);
  const dataLength = totalChunkLength - 12;
  const type = textEncoder.encode("tEXt");
  const data = new Uint8Array(dataLength);
  data.fill(0x20);
  data.set(textEncoder.encode("Padding\0"));
  const chunk = new Uint8Array(totalChunkLength);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, dataLength, false);
  chunk.set(type, 4);
  chunk.set(data, 8);
  view.setUint32(8 + dataLength, crc32(concatBytes([type, data])), false);
  return concatBytes([input.subarray(0, iendOffset), chunk, input.subarray(iendOffset)]);
}

function padWebp(input: Uint8Array, targetBytes: number) {
  const riff = textEncoder.encode("RIFF");
  const webp = textEncoder.encode("WEBP");
  if (!matches(input, 0, riff) || !matches(input, 8, webp)) throw new Error("不是有效的 WebP 文件");
  const remaining = targetBytes - input.length;
  const totalChunkLength = Math.max(8, remaining + (remaining % 2));
  const payloadLength = totalChunkLength - 8;
  const chunk = new Uint8Array(totalChunkLength);
  chunk.set(textEncoder.encode("JUNK"), 0);
  new DataView(chunk.buffer).setUint32(4, payloadLength, true);
  const output = concatBytes([input, chunk]);
  if (output.length - 8 > 0xffffffff) throw new Error("WebP 目标体积超过格式上限");
  new DataView(output.buffer).setUint32(4, output.length - 8, true);
  return output;
}

export function padImageBytes(input: Uint8Array, format: PaddedImageFormat, targetBytes: number) {
  if (!Number.isSafeInteger(targetBytes) || targetBytes <= 0) throw new Error("目标体积无效");
  if (targetBytes <= input.length) return input.slice();
  if (format === "jpeg") return padJpeg(input, targetBytes);
  if (format === "png") return padPng(input, targetBytes);
  return padWebp(input, targetBytes);
}

export async function padImageBlob(blob: Blob, format: PaddedImageFormat, targetBytes: number) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const padded = padImageBytes(bytes, format, targetBytes);
  return new Blob([padded], { type: `image/${format}` });
}
