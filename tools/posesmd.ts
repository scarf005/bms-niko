// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: posesmd.ts <mesh.smd> <anim.smd> <frame> <out.smd>; skins the mesh into an animation frame (bones matched by name)
type V = [number, number, number]; type M = [V, V, V]
const mul = (a: M, b: M): M => a.map((r) => [0, 1, 2].map((j) => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j])) as M
const tr = (a: M): M => [0, 1, 2].map((i) => [a[0][i], a[1][i], a[2][i]]) as M
const app = (a: M, v: V): V => a.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]) as V
const eul = ([x, y, z]: V): M => {
  const sr = Math.sin(x), cr = Math.cos(x), sp = Math.sin(y), cp = Math.cos(y), sy = Math.sin(z), cy = Math.cos(z)
  return [[cp * cy, sr * sp * cy - cr * sy, cr * sp * cy + sr * sy], [cp * sy, sr * sp * sy + cr * cy, cr * sp * sy - sr * cy], [-sp, sr * cp, cr * cp]]
}
const skel = (L: string[], frame: number) => {
  const nodes: { name: string; parent: number }[] = []; let i = L.findIndex((l) => l.trim() === "nodes") + 1
  for (; L[i].trim() !== "end"; i++) { const m = L[i].trim().match(/^(\d+)\s+"([^"]*)"\s+(-?\d+)/)!; nodes[+m[1]] = { name: m[2], parent: +m[3] } }
  const loc = new Map<number, number[]>()
  for (let f = 0; f <= frame; f++) {
    i = L.findIndex((l, j) => j > i && /^time\s+\d+/.test(l.trim())); if (i < 0) break
    for (i++; !/^(time|end)/.test(L[i].trim()); i++) { const n = L[i].trim().split(/\s+/).map(Number); loc.set(n[0], n.slice(1)) }
  }
  const w: { R: M; p: V }[] = []
  const get = (id: number): { R: M; p: V } => {
    if (w[id]) return w[id]; const l = loc.get(id)!, R = eul([l[3], l[4], l[5]]), p = [l[0], l[1], l[2]] as V, pa = nodes[id].parent
    if (pa < 0) return w[id] = { R, p }; const P = get(pa); const q = app(P.R, p)
    return w[id] = { R: mul(P.R, R), p: [P.p[0] + q[0], P.p[1] + q[1], P.p[2] + q[2]] }
  }
  return new Map(nodes.map((n, id) => [id, { name: n.name, ...get(id) }]))
}
const [meshF, animF, frameS, out] = Deno.args, ML = Deno.readTextFileSync(meshF).split(/\r?\n/)
const ref = skel(ML, 0), an = skel(Deno.readTextFileSync(animF).split(/\r?\n/), +frameS), byName = new Map([...an.values()].map((b) => [b.name, b]))
const xf = new Map([...ref].map(([id, r]) => { const a = byName.get(r.name) ?? r, R = mul(a.R, tr(r.R)); return [id, (v: V): V => { const q = app(R, [v[0] - r.p[0], v[1] - r.p[1], v[2] - r.p[2]]); return [q[0] + a.p[0], q[1] + a.p[1], q[2] + a.p[2]] }] }))
const t = ML.indexOf("triangles"), o = ML.slice(0, t + 1)
for (let i = t + 1; i < ML.length && ML[i].trim() !== "end"; i += 4) {
  o.push(ML[i])
  for (let k = 1; k <= 3; k++) {
    const s = ML[i + k].trim().split(/\s+/), n = +(s[9] ?? 0), links = n ? [...Array(n)].map((_, j) => [+s[10 + 2 * j], +s[11 + 2 * j]]) : [[+s[0], 1]]
    const p = [+s[1], +s[2], +s[3]] as V, acc: V = [0, 0, 0]; let tw = 0
    for (const [b, wt] of links) { const q = xf.get(b)!(p); for (let j = 0; j < 3; j++) acc[j] += q[j] * wt; tw += wt }
    s[1] = String(acc[0] / tw); s[2] = String(acc[1] / tw); s[3] = String(acc[2] / tw); o.push(s.join(" "))
  }
}
o.push("end"); Deno.writeTextFileSync(out, o.join("\n") + "\n")
