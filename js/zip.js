// 依存ライブラリなしの最小限のZIP読み書き（外部CDNに頼らずオフラインでも動くようにするため）。
// 書き込みは無圧縮（STORE方式）。読み込みはSTORE方式に加え、
// ブラウザがDecompressionStreamに対応していればDEFLATE方式（OSの圧縮フォルダ機能などで固め直した場合）にも対応する。

function strToUtf8Bytes(str) {
  return new TextEncoder().encode(str);
}

function utf8BytesToStr(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
}

// ----- CRC32 -----
let crcTable = null;
function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}
function crc32(bytes) {
  const table = getCrcTable();
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    c = table[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// DOSの日付/時刻形式（ZIPヘッダ用、厳密でなくてOK）
function dosDateTime(date) {
  const time = ((date.getHours() & 0x1F) << 11) | ((date.getMinutes() & 0x3F) << 5) | ((date.getSeconds() >> 1) & 0x1F);
  const day = (((date.getFullYear() - 1980) & 0x7F) << 9) | (((date.getMonth() + 1) & 0xF) << 5) | (date.getDate() & 0x1F);
  return { time, day };
}

function u16(v) { return [v & 0xFF, (v >> 8) & 0xFF]; }
function u32(v) { return [v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >>> 24) & 0xFF]; }

// entries: [{ name: string, text: string }]
export function makeZip(entries) {
  const now = new Date();
  const { time, day } = dosDateTime(now);
  const chunks = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = strToUtf8Bytes(entry.name);
    const dataBytes = strToUtf8Bytes(entry.text);
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    const localHeader = new Uint8Array([
      0x50, 0x4B, 0x03, 0x04, // local file header signature
      20, 0,                  // version needed
      0, 0x08,                // flags: bit11 = UTF-8 filename
      0, 0,                   // method: 0 = store
      ...u16(time), ...u16(day),
      ...u32(crc),
      ...u32(size),           // compressed size
      ...u32(size),           // uncompressed size
      ...u16(nameBytes.length),
      ...u16(0),               // extra field length
    ]);

    chunks.push(localHeader, nameBytes, dataBytes);

    const centralHeader = new Uint8Array([
      0x50, 0x4B, 0x01, 0x02, // central directory header signature
      20, 0,                   // version made by
      20, 0,                   // version needed
      0, 0x08,
      0, 0,
      ...u16(time), ...u16(day),
      ...u32(crc),
      ...u32(size),
      ...u32(size),
      ...u16(nameBytes.length),
      ...u16(0), ...u16(0),    // extra length, comment length
      ...u16(0),               // disk number start
      ...u16(0),               // internal attrs
      ...u32(0),               // external attrs
      ...u32(offset),          // offset of local header
    ]);
    centralParts.push(centralHeader, nameBytes);

    offset += localHeader.length + nameBytes.length + dataBytes.length;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const p of centralParts) centralSize += p.length;

  const endRecord = new Uint8Array([
    0x50, 0x4B, 0x05, 0x06,
    0, 0, 0, 0,
    ...u16(entries.length),
    ...u16(entries.length),
    ...u32(centralSize),
    ...u32(centralStart),
    0, 0,
  ]);

  const all = [...chunks, ...centralParts, endRecord];
  let totalLen = 0;
  for (const c of all) totalLen += c.length;
  const out = new Uint8Array(totalLen);
  let p = 0;
  for (const c of all) { out.set(c, p); p += c.length; }
  return out;
}

export function downloadZip(entries, filename) {
  const bytes = makeZip(entries);
  const blob = new Blob([bytes], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function readU16(view, off) { return view.getUint16(off, true); }
function readU32(view, off) { return view.getUint32(off, true); }

// ZIPファイル(ArrayBuffer)を読み込み、[{ name, text }] を返す。
// STORE方式(無圧縮)とDEFLATE方式(OS標準の圧縮フォルダなど)の両方に対応。
export async function readZip(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);

  // End of central directoryを末尾から探す
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 22 - 65536; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocdOffset = i; break; }
  }
  if (eocdOffset === -1) throw new Error('ZIPファイルとして認識できませんでした');

  const entryCount = readU16(view, eocdOffset + 10);
  const centralOffset = readU32(view, eocdOffset + 16);

  const results = [];
  let ptr = centralOffset;
  for (let i = 0; i < entryCount; i++) {
    if (readU32(view, ptr) !== 0x02014b50) break;
    const method = readU16(view, ptr + 10);
    const compSize = readU32(view, ptr + 20);
    const uncompSize = readU32(view, ptr + 24);
    const nameLen = readU16(view, ptr + 28);
    const extraLen = readU16(view, ptr + 30);
    const commentLen = readU16(view, ptr + 32);
    const localOffset = readU32(view, ptr + 42);
    const name = utf8BytesToStr(bytes.subarray(ptr + 46, ptr + 46 + nameLen));

    // ローカルヘッダから実データの開始位置を求める
    const lNameLen = readU16(view, localOffset + 26);
    const lExtraLen = readU16(view, localOffset + 28);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const rawData = bytes.subarray(dataStart, dataStart + compSize);

    let dataBytes;
    if (method === 0) {
      dataBytes = rawData;
    } else if (method === 8) {
      if (typeof DecompressionStream === 'undefined') {
        throw new Error(`「${name}」がDEFLATE圧縮されていますが、このブラウザはDEFLATE展開に対応していません`);
      }
      const ds = new DecompressionStream('deflate-raw');
      const stream = new Blob([rawData]).stream().pipeThrough(ds);
      const buf = await new Response(stream).arrayBuffer();
      dataBytes = new Uint8Array(buf);
    } else {
      throw new Error(`「${name}」は未対応の圧縮方式です`);
    }
    results.push({ name, text: utf8BytesToStr(dataBytes) });

    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return results;
}
