// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: bonecheck.ts <smd> <bone...> ; mean position of vertices whose main bone is <bone> vs the bone's bind world position
const L = Deno.readTextFileSync(Deno.args[0]).split(/\r?\n/)
let i = L.indexOf("nodes") + 1; const names: string[] = [], par: number[] = []
for (; L[i] !== "end"; i++) { const m = L[i].trim().match(/^(\d+)\s+"([^"]*)"\s+(-?\d+)/)!; names[+m[1]] = m[2]; par[+m[1]] = +m[3] }
while (L[i] !== "time 0") i++
type V = number[]; const loc: V[][] = []
for (i++; !/^(end|time)/.test(L[i]); i++) { const n = L[i].trim().split(/\s+/).map(Number); loc[n[0]] = [n.slice(1, 4), n.slice(4, 7)] }
const eul = ([x, y, z]: V) => { const sr = Math.sin(x), cr = Math.cos(x), sp = Math.sin(y), cp = Math.cos(y), sy = Math.sin(z), cy = Math.cos(z); return [[cp * cy, sr * sp * cy - cr * sy, cr * sp * cy + sr * sy], [cp * sy, sr * sp * sy + cr * cy, cr * sp * sy - sr * cy], [-sp, sr * cp, cr * cp]] }
const W: { R: number[][]; p: V }[] = []
const get = (b: number): { R: number[][]; p: V } => W[b] ??= par[b] < 0 ? { R: eul(loc[b][1]), p: loc[b][0] } : (() => { const P = get(par[b]), l = eul(loc[b][1]); return { R: P.R.map((r) => [0, 1, 2].map((j) => r[0] * l[0][j] + r[1] * l[1][j] + r[2] * l[2][j])), p: P.p.map((v, k) => v + P.R[k][0] * loc[b][0][0] + P.R[k][1] * loc[b][0][1] + P.R[k][2] * loc[b][0][2]) } })()
while (L[i] !== "triangles") i++
const acc = new Map<number, number[]>()
for (i++; L[i] !== "end" && i < L.length; i++) { const t = L[i].trim().split(/\s+/); if (t.length < 9) continue; const b = +t[0], a = acc.get(b) ?? [0, 0, 0, 0]; a[0] += +t[1]; a[1] += +t[2]; a[2] += +t[3]; a[3]++; acc.set(b, a) }
for (const n of Deno.args.slice(1)) { const b = names.indexOf(n), a = acc.get(b)!, w = get(b); console.log(n, "verts", a?.[3], "mean", a?.slice(0, 3).map((v) => (v / a[3]).toFixed(1)).join(","), "bone", w.p.map((v) => v.toFixed(1)).join(",")) }
