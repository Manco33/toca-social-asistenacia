import sharp from 'sharp';
import fs from 'node:fs';

const SRC = 'public/boco-marcaje-original.jpg';
const meta = await sharp(SRC).metadata();
console.log('src', meta.width, meta.height);

// Detectar el cuadrado azul marino: pixeles oscuros
const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
let minX = info.width, minY = info.height, maxX = 0, maxY = 0;
const ch = info.channels;
for (let y = 0; y < info.height * 0.72; y++) {
  for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * ch;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (r < 60 && g < 80 && b > 70 && b < 160) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
}
console.log('bbox', minX, minY, maxX, maxY);
const w = maxX - minX + 1, h = maxY - minY + 1;
const side = Math.min(w, h);
const cx = Math.round((minX + maxX) / 2), cy = Math.round((minY + maxY) / 2);
const left = cx - Math.round(side / 2), top = cy - Math.round(side / 2);

// pixel de color navy
const pi = ((cy + Math.round(side * 0.3)) * info.width + (cx - Math.round(side * 0.42))) * ch;
const navy = { r: data[pi], g: data[pi + 1], b: data[pi + 2] };
console.log('navy', navy);

const iconRaw = await sharp(SRC).extract({ left, top, width: side, height: side }).png().toBuffer();

// Mascara redondeada (squircle aproximado)
const rr = Math.round(side * 0.225);
const mask = Buffer.from(`<svg width="${side}" height="${side}"><rect x="0" y="0" width="${side}" height="${side}" rx="${rr}" ry="${rr}" fill="#fff"/></svg>`);
const rounded = await sharp(iconRaw).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();

// Version interior (sin bordes redondeados) para maskable / apple
const inset = Math.round(side * 0.10);
const inner = await sharp(iconRaw).extract({ left: inset, top: inset, width: side - inset * 2, height: side - inset * 2 }).png().toBuffer();

const bg = { r: navy.r, g: navy.g, b: navy.b, alpha: 1 };
async function maskable(size, scale) {
  const inner2 = Math.round(size * scale);
  const resized = await sharp(inner).resize(inner2, inner2).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: resized, gravity: 'centre' }]).png().toBuffer();
}

const out = (p, buf) => fs.writeFileSync(p, buf);
for (const s of [192, 512]) {
  out(`public/icon-${s}x${s}.png`, await sharp(rounded).resize(s, s).png().toBuffer());
  out(`public/icon-maskable-${s}x${s}.png`, await maskable(s, 0.68));
}
out('public/icon-checkin-192x192.png', await sharp(rounded).resize(192, 192).png().toBuffer());
out('public/icon-checkout-192x192.png', await sharp(rounded).resize(192, 192).png().toBuffer());
out('public/boco-marcaje-icon.png', await sharp(rounded).resize(512, 512).png().toBuffer());
out('src/app/icon.png', await sharp(rounded).resize(256, 256).png().toBuffer());
out('src/app/apple-icon.png', await maskable(180, 0.86));
console.log('iconos generados');

// Logos de marca
await sharp('logos/Sky-Zone-Logo.png').trim().resize({ width: 900 }).png().toFile('public/marcas/sky-zone.png');
console.log('logos listos');

