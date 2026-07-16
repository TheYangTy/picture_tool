export type ZipEntry = {
  name: string;
  data: Blob | ArrayBuffer | Uint8Array;
};

const encoder = new TextEncoder();

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

function asBytes(value: Blob | ArrayBuffer | Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  if (value instanceof Uint8Array) return Promise.resolve(new Uint8Array(value));
  if (value instanceof ArrayBuffer) return Promise.resolve(new Uint8Array(value));
  return value.arrayBuffer().then((buffer) => new Uint8Array(buffer));
}

export function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function safeZipName(name: string) {
  const clean = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/^\.+/, "").trim();
  return clean || "image";
}

export async function createZipBlob(entries: ZipEntry[]) {
  if (!entries.length) throw new Error("ZIP 至少需要一个文件");
  if (entries.length > 0xffff) throw new Error("ZIP 文件数量超过格式限制");

  const localParts: Uint8Array<ArrayBuffer>[] = [];
  const centralParts: Uint8Array<ArrayBuffer>[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(safeZipName(entry.name));
    const data = await asBytes(entry.data);
    if (data.byteLength > 0xffffffff || localOffset > 0xffffffff) {
      throw new Error("批量结果过大，当前浏览器无法生成 ZIP");
    }
    const checksum = crc32(data);

    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0x0800);
    writeUint16(localView, 8, 0);
    writeUint32(localView, 14, checksum);
    writeUint32(localView, 18, data.byteLength);
    writeUint32(localView, 22, data.byteLength);
    writeUint16(localView, 26, nameBytes.byteLength);
    localParts.push(localHeader, nameBytes, data);

    const centralHeader = new Uint8Array(46);
    const centralView = new DataView(centralHeader.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0x0800);
    writeUint16(centralView, 10, 0);
    writeUint32(centralView, 16, checksum);
    writeUint32(centralView, 20, data.byteLength);
    writeUint32(centralView, 24, data.byteLength);
    writeUint16(centralView, 28, nameBytes.byteLength);
    writeUint32(centralView, 42, localOffset);
    centralParts.push(centralHeader, nameBytes);

    localOffset += localHeader.byteLength + nameBytes.byteLength + data.byteLength;
  }

  const centralSize = centralParts.reduce((total, part) => total + part.byteLength, 0);
  const footer = new Uint8Array(22);
  const footerView = new DataView(footer.buffer);
  writeUint32(footerView, 0, 0x06054b50);
  writeUint16(footerView, 8, entries.length);
  writeUint16(footerView, 10, entries.length);
  writeUint32(footerView, 12, centralSize);
  writeUint32(footerView, 16, localOffset);

  return new Blob([...localParts, ...centralParts, footer], { type: "application/zip" });
}
