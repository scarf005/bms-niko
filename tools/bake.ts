// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: bake.ts <outDir> <keep,bones> <mesh.smd...> -- <anim.smd...>
// keeps the bones the meshes weight plus the listed ones and their ancestors, each parented to its nearest kept ancestor;
// every frame of every SMD gets the kept bones' world transforms re-expressed in that parent, so the motion is unchanged
type V = [number, number, number]; type M = [V, V, V]
const mul = (a: M, b: M): M => a.map((r) => [0, 1, 2].map((j) => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j])) as M
const tr = (a: M): M => [0, 1, 2].map((i) => [a[0][i], a[1][i], a[2][i]]) as M
const app = (a: M, v: V): V => a.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]) as V
const eul = ([x, y, z]: number[]): M => {
  const sr = Math.sin(x), cr = Math.cos(x), sp = Math.sin(y), cp = Math.cos(y), sy = Math.sin(z), cy = Math.cos(z)
  return [[cp * cy, sr * sp * cy - cr * sy, cr * sp * cy + sr * sy], [cp * sy, sr * sp * sy + cr * cy, cr * sp * sy - sr * cy], [-sp, sr * cp, cr * cp]]
}
const toEul = (m: M): V => {
  const sp = -m[2][0], y = Math.asin(Math.max(-1, Math.min(1, sp)))
  if (Math.abs(sp) > 0.99999) return [0, y, Math.atan2(-m[0][1], m[1][1])]
  return [Math.atan2(m[2][1], m[2][2]), y, Math.atan2(m[1][0], m[0][0])]
}
const sep = Deno.args.indexOf("--"), [out, keepArg] = Deno.args, meshes = Deno.args.slice(2, sep < 0 ? undefined : sep), anims = sep < 0 ? [] : Deno.args.slice(sep + 1)
type Node = { name: string; parent: number }
const nodesOf = (L: string[]) => {
  const n: Node[] = []; let i = L.findIndex((l) => l.trim() === "nodes") + 1
  for (; L[i].trim() !== "end"; i++) { const m = L[i].trim().match(/^(\d+)\s+"([^"]*)"\s+(-?\d+)/)!; n[+m[1]] = { name: m[2], parent: +m[3] } }
  return n
}
// bones weighted by any mesh, by name
const keep = new Set(keepArg.split(",").filter(Boolean).map((s) => s.toLowerCase()))
for (const f of meshes) {
  const L = Deno.readTextFileSync(f).split(/\r?\n/), n = nodesOf(L)
  for (let i = L.indexOf("triangles") + 1; i < L.length && L[i].trim() !== "end"; i += 4) for (let k = 1; k <= 3; k++) {
    const t = L[i + k].trim().split(/\s+/).map(Number), c = t[9] ?? 0
    if (!c) keep.add(n[t[0]].name.toLowerCase())
    for (let j = 0; j < c; j++) if (t[11 + 2 * j] > 0) keep.add(n[t[10 + 2 * j]].name.toLowerCase())
  }
}
await Deno.mkdir(out, { recursive: true })
let report = ""
for (const f of [...meshes, ...anims]) {
  const L = Deno.readTextFileSync(f).split(/\r?\n/), n = nodesOf(L)
  // ancestors stay too, so blends between sequences still interpolate along the original chains
  const ids = new Set(n.map((b, i) => keep.has(b.name.toLowerCase()) ? i : -1).filter((i) => i >= 0))
  for (const i of [...ids]) for (let p = n[i].parent; p >= 0; p = n[p].parent) ids.add(p)
  const kept = [...ids].sort((a, b) => a - b), newId = new Map(kept.map((i, k) => [i, k]))
  const keptParent = (i: number) => { let p = n[i].parent; while (p >= 0 && !newId.has(p)) p = n[p].parent; return p }
  const nearest = (i: number) => { let p = i; while (p >= 0 && !newId.has(p)) p = n[p].parent; return p < 0 ? 0 : newId.get(p)! }
  const o = ["version 1", "nodes", ...kept.map((i, k) => `  ${k} "${n[i].name}" ${keptParent(i) < 0 ? -1 : newId.get(keptParent(i))}`), "end", "skeleton"]
  let i = L.findIndex((l) => l.trim() === "skeleton") + 1
  const loc = new Map<number, number[]>()
  while (i < L.length && /^time\s/.test(L[i].trim())) {
    o.push(L[i].trim())
    for (i++; !/^(time|end)/.test(L[i].trim()); i++) { const t = L[i].trim().split(/\s+/).map(Number); loc.set(t[0], t.slice(1)) }
    const w = new Map<number, { R: M; p: V }>()
    const get = (b: number): { R: M; p: V } => {
      if (w.has(b)) return w.get(b)!
      const l = loc.get(b)!, R = eul(l.slice(3)), p = l.slice(0, 3) as V, pa = n[b].parent
      if (pa < 0) { w.set(b, { R, p }); return w.get(b)! }
      const P = get(pa), q = app(P.R, p); w.set(b, { R: mul(P.R, R), p: [P.p[0] + q[0], P.p[1] + q[1], P.p[2] + q[2]] }); return w.get(b)!
    }
    for (const b of kept) {
      const W = get(b), pa = keptParent(b)
      let R = W.R, p = W.p
      if (pa >= 0) { const P = get(pa), Pt = tr(P.R); R = mul(Pt, W.R); p = app(Pt, [W.p[0] - P.p[0], W.p[1] - P.p[1], W.p[2] - P.p[2]]) }
      o.push(`${newId.get(b)} ${[...p, ...toEul(R)].map((x) => x.toFixed(6)).join(" ")}`)
    }
  }
  o.push("end")
  const t = L.indexOf("triangles")
  if (t >= 0) {
    o.push("triangles")
    for (let j = t + 1; j < L.length && L[j].trim() !== "end"; j += 4) {
      o.push(L[j].trim())
      for (let k = 1; k <= 3; k++) {
        const s = L[j + k].trim().split(/\s+/), c = +(s[9] ?? 0), acc = new Map<number, number>()
        for (let x = 0; x < c; x++) { const b = nearest(+s[10 + 2 * x]); acc.set(b, (acc.get(b) ?? 0) + +s[11 + 2 * x]) }
        s[0] = String(nearest(+s[0]))
        o.push(c ? [...s.slice(0, 9), acc.size, ...[...acc].flat()].join(" ") : s.join(" "))
      }
    }
    o.push("end")
  }
  Deno.writeTextFileSync(`${out}/${f.split("/").pop()}`, o.join("\n") + "\n")
  report = `${kept.length} of ${n.length} bones`
}
console.log(report)
