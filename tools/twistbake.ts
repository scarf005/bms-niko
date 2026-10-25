// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: twistbake.ts <rig.smd> <in.smd> <out.smd>; the rigs pronate the hand on the wrist bone alone, so this animates the unused
// forearm twist bone (SCI_Hand_Forearm_<side>) with the wrist's roll about the forearm axis, frame by frame, for the sleeve to follow
type V = [number, number, number]; type M = [V, V, V]
const mul = (a: M, b: M): M => a.map((r) => [0, 1, 2].map((j) => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j])) as M
const tr = (a: M): M => [0, 1, 2].map((i) => [a[0][i], a[1][i], a[2][i]]) as M
const app = (a: M, v: V): V => a.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]) as V
const eul = ([x, y, z]: number[]): M => {
  const sr = Math.sin(x), cr = Math.cos(x), sp = Math.sin(y), cp = Math.cos(y), sy = Math.sin(z), cy = Math.cos(z)
  return [[cp * cy, sr * sp * cy - cr * sy, cr * sp * cy + sr * sy], [cp * sy, sr * sp * sy + cr * cy, cr * sp * sy - sr * cy], [-sp, sr * cp, cr * cp]]
}
const toEul = (m: M): V => [Math.atan2(m[2][1], m[2][2]), Math.asin(Math.max(-1, Math.min(1, -m[2][0]))), Math.atan2(m[1][0], m[0][0])]
const axisAngle = (a: V, t: number): M => {
  const c = Math.cos(t), s = Math.sin(t), k = 1 - c, [x, y, z] = a
  return [[c + x * x * k, x * y * k - z * s, x * z * k + y * s], [y * x * k + z * s, c + y * y * k, y * z * k - x * s], [z * x * k - y * s, z * y * k + x * s, c + z * z * k]]
}
// twist angle of rotation m about unit axis a (swing-twist split of its quaternion)
const twist = (m: M, a: V) => {
  const w = Math.sqrt(Math.max(0, 1 + m[0][0] + m[1][1] + m[2][2])) / 2, d = 4 * w || 1e-9
  const q: V = [(m[2][1] - m[1][2]) / d, (m[0][2] - m[2][0]) / d, (m[1][0] - m[0][1]) / d]
  return 2 * Math.atan2(q[0] * a[0] + q[1] * a[1] + q[2] * a[2], w)
}
const parse = (f: string) => {
  const L = Deno.readTextFileSync(f).split(/\r?\n/), id = new Map<string, number>()
  let i = L.findIndex((l) => l.trim() === "nodes") + 1
  for (; L[i].trim() !== "end"; i++) { const m = L[i].trim().match(/^(\d+)\s+"([^"]*)"/)!; id.set(m[2], +m[1]) }
  return { L, id }
}
const [rigF, inF, outF] = Deno.args, rig = parse(rigF), A = parse(inF)
const rest = new Map<number, number[]>()
for (let i = rig.L.findIndex((l) => /^time 0\b/.test(l.trim())) + 1; !/^(time|end)/.test(rig.L[i].trim()); i++) { const n = rig.L[i].trim().split(/\s+/).map(Number); rest.set(n[0], n.slice(1)) }
const sides = ["L", "R"].flatMap((s) => {
  const [f, w, t] = [`${s}_Forearm`, `${s}_Wrist`, `SCI_Hand_Forearm_${s}`]
  if (![f, w, t].every((n) => rig.id.has(n) && A.id.has(n))) return []
  const wr = rest.get(rig.id.get(w)!)!, tb = rest.get(rig.id.get(t)!)!, l = Math.hypot(wr[0], wr[1], wr[2])
  return [{ w: A.id.get(w)!, t: A.id.get(t)!, W0: eul(wr.slice(3)), a: wr.slice(0, 3).map((x) => x / l) as V, p0: tb.slice(0, 3) as V, T0: eul(tb.slice(3)) }]
})
const fmt = (x: number) => x.toFixed(6)
const out: string[] = []
for (let i = 0; i < A.L.length; i++) {
  out.push(A.L[i])
  if (!/^time\s+\d+/.test(A.L[i].trim())) continue
  const fr: { id: number; line: string; v: number[] }[] = []
  for (i++; i < A.L.length && !/^(time|end)/.test(A.L[i].trim()); i++) { const v = A.L[i].trim().split(/\s+/).map(Number); fr.push({ id: v[0], line: A.L[i], v: v.slice(1) }) }
  i--
  for (const s of sides) {
    const wl = fr.find((x) => x.id === s.w); if (!wl) continue
    const T = axisAngle(s.a, twist(mul(eul(wl.v.slice(3)), tr(s.W0)), s.a)), p = app(T, s.p0), r = toEul(mul(T, s.T0))
    const line = `    ${s.t} ${[...p, ...r].map(fmt).join(" ")}`, k = fr.findIndex((x) => x.id === s.t)
    if (k >= 0) fr[k].line = line; else fr.push({ id: s.t, line, v: [] })
  }
  out.push(...fr.map((x) => x.line))
}
Deno.writeTextFileSync(outF, out.join("\n"))
