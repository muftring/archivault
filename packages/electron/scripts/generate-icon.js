#!/usr/bin/env node
// Generates a simple placeholder 1024x1024 app icon (flat vault/lock motif) as
// a raw PNG, with no image-processing dependencies. electron-icon-builder then
// derives the platform-specific icns/ico/png set from this single source file.
const { deflateSync } = require('zlib');
const { writeFileSync } = require('fs');
const path = require('path');

const SIZE = 1024;
const BG = [108, 92, 231]; // accent purple
const FG = [255, 255, 255]; // white door
const DARK = [30, 30, 46]; // dark keyhole

function dist(x, y, cx, cy) {
  return Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
}

function roundedRectMask(x, y, w, h, r) {
  // Distance-based rounded-rect containment test centered at (w/2, h/2).
  const cx = w / 2;
  const cy = h / 2;
  const dx = Math.abs(x - cx) - (cx - r);
  const dy = Math.abs(y - cy) - (cy - r);
  if (dx <= 0 || dy <= 0) return true;
  return dx * dx + dy * dy <= r * r;
}

const pixels = Buffer.alloc(SIZE * SIZE * 4);

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const idx = (y * SIZE + x) * 4;
    let color = null;

    if (roundedRectMask(x, y, SIZE, SIZE, 180)) {
      color = BG;

      // Outer white "vault door" circle.
      const doorR = 330;
      const cx = SIZE / 2;
      const cy = SIZE / 2;
      const d = dist(x, y, cx, cy);
      if (d <= doorR) {
        color = FG;
        if (d <= doorR - 28) {
          color = BG;
        }
      }

      // Keyhole (circle + tapered stem) in the center, dark.
      const holeR = 70;
      const holeCy = cy - 30;
      if (dist(x, y, cx, holeCy) <= holeR) {
        color = DARK;
      }
      // Stem: trapezoid narrowing downward from the hole.
      const stemTop = holeCy + holeR - 10;
      const stemBottom = cy + 150;
      if (y >= stemTop && y <= stemBottom) {
        const t = (y - stemTop) / (stemBottom - stemTop);
        const halfWidth = 34 - 14 * t;
        if (Math.abs(x - cx) <= halfWidth) {
          color = DARK;
        }
      }
    }

    if (color) {
      pixels[idx] = color[0];
      pixels[idx + 1] = color[1];
      pixels[idx + 2] = color[2];
      pixels[idx + 3] = 255;
    } else {
      pixels[idx + 3] = 0;
    }
  }
}

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Raw scanlines, each prefixed with filter byte 0 (none).
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (SIZE * 4 + 1);
  raw[rowStart] = 0;
  pixels.copy(raw, rowStart + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const png = Buffer.concat([
  signature,
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const outPath = path.join(__dirname, '..', 'build', 'icon.png');
writeFileSync(outPath, png);
console.log(`Wrote ${outPath} (${png.length} bytes)`);
