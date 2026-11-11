import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pngToIco from 'png-to-ico';

const root = path.dirname(fileURLToPath(import.meta.url));

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(size) {
  const px = Buffer.alloc(size * size * 4);
  const u = (x) => x / size;

  const inRoundedRect = (x, y) => {
    const r = u(96);
    if (x < r && y < r) return (x - r) ** 2 + (y - r) ** 2 <= r * r;
    if (x > 1 - r && y < r) return (x - (1 - r)) ** 2 + (y - r) ** 2 <= r * r;
    if (x < r && y > 1 - r) return (x - r) ** 2 + (y - (1 - r)) ** 2 <= r * r;
    if (x > 1 - r && y > 1 - r) return (x - (1 - r)) ** 2 + (y - (1 - r)) ** 2 <= r * r;
    return true;
  };

  const distToSeg = (pxx, pyy, ax, ay, bx, by) => {
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((pxx - ax) * dx + (pyy - ay) * dy) / (dx * dx + dy * dy)));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    return Math.hypot(pxx - cx, pyy - cy);
  };

  const apex = [0.5, 0.2];
  const leftLeg = [0.2, 0.8];
  const rightLeg = [0.8, 0.8];
  const halfW = 0.075;
  const barY = [0.56, 0.68];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const ux = (x + 0.5) / size;
      const uy = (y + 0.5) / size;
      const i = (y * size + x) * 4;
      if (!inRoundedRect(ux, uy)) {
        px[i + 3] = 0;
        continue;
      }
      const t = (ux + uy) / 2;
      let rr = Math.round(29 + t * (59 - 29));
      let gg = Math.round(78 + t * (130 - 78));
      let bb = Math.round(216 + t * (246 - 216));
      const d1 = distToSeg(ux, uy, apex[0], apex[1], leftLeg[0], leftLeg[1]);
      const d2 = distToSeg(ux, uy, apex[0], apex[1], rightLeg[0], rightLeg[1]);
      const d3 = uy > barY[0] && uy < barY[1] && ux > 0.33 && ux < 0.67;
      const isWhite = d1 < halfW || d2 < halfW || d3;
      if (isWhite) {
        rr = 255; gg = 255; bb = 255;
      }
      px[i] = rr; px[i + 1] = gg; px[i + 2] = bb; px[i + 3] = 255;
    }
  }

  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const sizes = [256, 128, 64, 48, 32, 16];
const pngs = sizes.map(makePng);
const outDir = path.join(root, '..', 'build');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon.png'), pngs[0]);
const ico = await pngToIco(pngs);
fs.writeFileSync(path.join(outDir, 'icon.ico'), ico);
console.log('build/icon.ico et build/icon.png générés');
