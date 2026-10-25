// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: vtfalpha.ts <file.vtf...> ; prints format and alpha histogram of the largest mip (DXT5 block endpoints / DXT1 / uncompressed)
for (const p of Deno.args) {
  const b = await Deno.readFile(p);
  const dv = new DataView(b.buffer);
  const w = dv.getUint16(16, true), h = dv.getUint16(18, true);
  const flags = dv.getUint32(20, true);
  const fmt = dv.getInt32(52, true), mips = b[56];
  const hdr = dv.getUint32(12, true);
  const lw = dv.getUint8(57) ? 0 : 0;
  const lowFmt = dv.getInt32(57, true), lowW = b[61], lowH = b[62];
  const bpb = fmt === 13 ? 8 : fmt === 15 || fmt === 14 ? 16 : 0;
  const lowSize = lowFmt === 13 ? Math.max(1, Math.ceil(lowW / 4)) * Math.max(1, Math.ceil(lowH / 4)) * 8 : 0;
  if (bpb === 0) { console.log(p, "fmt", fmt, w, h, "flags", flags.toString(16)); continue; }
  const size = (x: number, y: number) => Math.max(1, Math.ceil(x / 4)) * Math.max(1, Math.ceil(y / 4)) * bpb;
  let total = 0; for (let m = 0; m < mips; m++) total += size(Math.max(1, w >> m), Math.max(1, h >> m));
  // data stored smallest mip first; largest mip is last
  const start = b.length - size(w, h);
  const hist = new Array(11).fill(0);
  if (fmt === 15) for (let o = start; o < b.length; o += 16) { hist[Math.round(b[o] / 25.5)]++; hist[Math.round(b[o + 1] / 25.5)]++; }
  console.log(p.split("/").pop(), "fmt", fmt, w, h, "flags", flags.toString(16), fmt === 15 ? "alpha endpoint hist(0..1 step .1): " + hist.join(",") : "");
}
