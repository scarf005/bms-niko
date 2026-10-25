// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
const [file, pat] = Deno.args
const b = await Deno.readFile(file); const dv = new DataView(b.buffer)
const ver = dv.getUint32(4, true); const treeSize = dv.getUint32(8, true)
let p = ver === 2 ? 28 : 12; const end = p + treeSize
const td = new TextDecoder()
const str = () => { const s = p; while (b[p] !== 0) p++; const r = td.decode(b.subarray(s, p)); p++; return r }
const re = new RegExp(pat)
while (p < end) { const ext = str(); if (!ext) break
  while (true) { const dir = str(); if (!dir) break
    while (true) { const name = str(); if (!name) break
      const arch = dv.getUint16(p + 6, true), off = dv.getUint32(p + 8, true), len = dv.getUint32(p + 12, true)
      p += 18 + dv.getUint16(p + 4, true)
      const full = `${dir}/${name}.${ext}`
      if (re.test(full)) console.log(full, arch, off, len) } } }
