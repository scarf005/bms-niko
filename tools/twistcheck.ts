// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: twistcheck.ts <rig.smd>; twist-bone weight share vs position along the left forearm (elbow 0, wrist 1)
const L = Deno.readTextFileSync(Deno.args[0]).split(/\r?\n/), id = new Map<string, number>()
let i = L.findIndex((l) => l.trim() === "nodes") + 1
for (; L[i].trim() !== "end"; i++) { const m = L[i].trim().match(/^(\d+)\s+"([^"]*)"/)!; id.set(m[2], +m[1]) }
const f = id.get("L_Forearm")!, tw = id.get("SCI_Hand_Forearm_L")!, wr = id.get("L_Wrist")!
const bins: number[][] = [...Array(12)].map(() => [])
// positions of joints approximated by mean of vertices dominated by each bone is unreliable; use bind-pose skeleton through posesmd-like math is overkill: project onto the axis between bone-dominated vertex centroids
const verts: { p: number[]; w: Map<number, number> }[] = []
for (i = L.indexOf("triangles") + 1; i < L.length && L[i].trim() !== "end"; i += 4) for (let k = 1; k <= 3; k++) {
  const s = L[i + k].trim().split(/\s+/).map(Number), n = s[9] ?? 0, w = new Map<number, number>()
  for (let j = 0; j < n; j++) w.set(s[10 + 2 * j], s[11 + 2 * j]); verts.push({ p: s.slice(1, 4), w })
}
const cen = (b: number) => { const vs = verts.filter((v) => (v.w.get(b) ?? 0) > 0.9); return [0, 1, 2].map((k) => vs.reduce((a, v) => a + v.p[k], 0) / vs.length) }
const a = cen(f), b = cen(wr), d = [0, 1, 2].map((k) => b[k] - a[k]), dd = d.reduce((s, x) => s + x * x, 0)
for (const v of verts) {
  const fw = (v.w.get(f) ?? 0) + (v.w.get(tw) ?? 0); if (fw < 0.5) continue
  const t = [0, 1, 2].reduce((s, k) => s + (v.p[k] - a[k]) * d[k], 0) / dd, bi = Math.max(0, Math.min(11, Math.floor((t + 0.5) * 6)))
  bins[bi].push((v.w.get(tw) ?? 0) / fw)
}
bins.forEach((x, k) => x.length && console.log(((k / 6) - 0.5).toFixed(2), x.length, (x.reduce((s, y) => s + y, 0) / x.length).toFixed(2)))
