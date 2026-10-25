// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: smdbones.ts <smd>...; per-material distinct bones, max links, triangle count
for (const f of Deno.args) {
  const L = (await Deno.readTextFile(f)).split("\n"), t = L.indexOf("triangles")
  const per = new Map<string, { b: Set<number>; tri: number; maxl: number }>()
  for (let i = t + 1; i + 3 < L.length && L[i].trim() !== "end"; i += 4) {
    const m = L[i].trim(), e = per.get(m) ?? { b: new Set(), tri: 0, maxl: 0 }
    e.tri++
    for (let k = 1; k <= 3; k++) {
      const p = L[i + k].trim().split(/\s+/), n = +p[9]
      e.maxl = Math.max(e.maxl, n); for (let j = 0; j < n; j++) e.b.add(+p[10 + 2 * j])
    }
    per.set(m, e)
  }
  console.log(f.split("/").pop(), [...per].map(([m, e]) => `${m}: tri ${e.tri} bones ${e.b.size} maxl ${e.maxl}`).join(" | "))
}
