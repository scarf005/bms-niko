// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: vvdcheck.ts <vvd> <numbones>; reports vertices with invalid bone weights
const b = await Deno.readFile(Deno.args[0]), v = new DataView(b.buffer), nb = +Deno.args[1]
const n = v.getInt32(16, true), start = v.getInt32(56, true)
let bad = 0
const why = new Map<string, number>()
for (let i = 0; i < n; i++) {
  const o = start + i * 48, w = [0, 1, 2].map((k) => v.getFloat32(o + 4 * k, true)), bone = [0, 1, 2].map((k) => b[o + 12 + k]), c = b[o + 15]
  const used = w.slice(0, c).reduce((a, x) => a + x, 0)
  const r = c < 1 || c > 3 ? "count" : Math.abs(used - 1) > 0.01 ? "sum" : bone.slice(0, c).some((x) => x >= nb) ? "index" : w.slice(0, c).some((x) => x <= 0) ? "zero" : w.slice(0, c).some((x) => !Number.isFinite(x)) ? "nan" : ""
  if (r) { bad++; why.set(r, (why.get(r) ?? 0) + 1); if (bad < 4) console.log(i, r, w, bone, c) }
}
console.log("verts", n, "bad", bad, [...why])
