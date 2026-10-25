// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
const [mdlPath, vvdPath] = Deno.args
const m = await Deno.readFile(mdlPath), v = new DataView(m.buffer)
const n = v.getInt32(156, true), idx = v.getInt32(160, true)
const dec = new TextDecoder()
const name = (o: number) => { let e = o; while (m[e]) e++; return dec.decode(m.subarray(o, e)) }
const bones = Array.from({ length: n }, (_, i) => {
  const o = idx + i * 216
  return { i, name: name(o + v.getInt32(o, true)), parent: v.getInt32(o + 4, true) }
})
const g = await Deno.readFile(vvdPath), w = new DataView(g.buffer)
const nv = w.getInt32(16, true), vs = w.getInt32(60 - 4 + 0, true)
const start = w.getInt32(56, true)
const used = new Set<number>()
for (let k = 0; k < nv; k++) {
  const o = start + k * 48
  const nb = g[o + 15]
  for (let j = 0; j < nb; j++) used.add(g[o + 12 + j])
}
const keep = new Set(used)
for (const b of used) { let p = bones[b].parent; while (p >= 0 && !keep.has(p)) { keep.add(p); p = bones[p].parent } }
console.log({ total: n, verts: nv, weighted: used.size, withAncestors: keep.size })
console.log([...used].sort((a, b) => a - b).map((i) => bones[i].name).join(" "))
console.log("--unweighted:", bones.filter((b) => !keep.has(b.i)).map((b) => b.name).join(" "))
