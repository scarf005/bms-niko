// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: vpkx.ts <dirvpk> <regex> <outDir>; extracts matching entries (archive-indexed) preserving basename
const [dirFile, pat, out] = Deno.args
const dir = dirFile.replace(/_dir\.vpk$/, "")
const b = await Deno.readFile(dirFile), dv = new DataView(b.buffer), treeSize = dv.getUint32(8, true), hdr = dv.getUint32(4, true) === 2 ? 28 : 12
let p = hdr; const end = p + treeSize, td = new TextDecoder(), re = new RegExp(pat)
const str = () => { const s = p; while (b[p] !== 0) p++; const r = td.decode(b.subarray(s, p)); p++; return r }
await Deno.mkdir(out, { recursive: true })
while (p < end) { const ext = str(); if (!ext) break
  while (true) { const d = str(); if (!d) break
    while (true) { const name = str(); if (!name) break
      const pre = dv.getUint16(p + 4, true), arch = dv.getUint16(p + 6, true), off = dv.getUint32(p + 8, true), len = dv.getUint32(p + 12, true)
      const preload = b.subarray(p + 18, p + 18 + pre); p += 18 + pre
      const full = `${d}/${name}.${ext}`
      if (!re.test(full) || arch === 0x7fff) continue
      const f = await Deno.open(`${dir}_${String(arch).padStart(3, "0")}.vpk`); await f.seek(off, Deno.SeekMode.Start)
      const data = new Uint8Array(len); let n = 0; while (n < len) { const r = await f.read(data.subarray(n)); if (!r) break; n += r }; f.close()
      const o = new Uint8Array(pre + len); o.set(preload); o.set(data, pre)
      await Deno.writeFile(`${out}/${name}.${ext}`, o); console.log(full, o.length) } } }
