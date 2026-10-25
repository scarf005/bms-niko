// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: stats.ts <dir>; per non-biped bone: parent, accumulated weight over all ref SMD vertices
const dir = Deno.args[0]
const nodes: { name: string; parent: number }[] = []
const w = new Map<number, number>()
for await (const e of Deno.readDir(dir)) {
  if (!e.name.endsWith(".smd") || e.name.includes("physics")) continue
  const L = (await Deno.readTextFile(`${dir}/${e.name}`)).split(/\r?\n/)
  if (!nodes.length) for (let i = L.indexOf("nodes") + 1; L[i] !== "end"; i++) { const m = L[i].match(/^\s*(\d+)\s+"([^"]+)"\s+(-?\d+)/)!; nodes[+m[1]] = { name: m[2], parent: +m[3] } }
  const t = L.indexOf("triangles")
  if (t < 0) continue
  for (let i = t + 1; L[i] !== "end" && i < L.length; i += 4) for (let k = 1; k <= 3; k++) {
    const p = L[i + k].trim().split(/\s+/)
    if (p.length > 9) { const n = +p[9]; for (let j = 0; j < n; j++) w.set(+p[10 + 2 * j], (w.get(+p[10 + 2 * j]) ?? 0) + +p[11 + 2 * j]) }
    else w.set(+p[0], (w.get(+p[0]) ?? 0) + 1)
  }
}
nodes.forEach((n, id) => { if (!n.name.startsWith("ValveBiped.Bip01_")) console.log(id, n.name, "<-", nodes[n.parent]?.name, (w.get(id) ?? 0).toFixed(1)) })
