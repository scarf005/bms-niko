// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: hl2rigid.ts <weapon> <donor>; for HL2 viewmodels with a hand that is a rigid part of the gun instead of an arm bone
// chain (AR2, gravity guns, RPG, the SMG1 and 357 right hands): moves the donor viewmodel build's nike arm of that side onto it,
// fitted by ICP of the donor's hand mesh onto the weapon's, and appends it to hl2/w/<weapon>/build/nike_arms_w.smd skinned to the
// bone that carries that hand
import { determinant, Matrix, SingularValueDecomposition } from "npm:ml-matrix@6.12.0"
type V3 = [number, number, number]
type Tri = { mat: string, v: { bone: number, p: V3, n: V3, rest: string[] }[] }
const parse = (f: string) => {
  const L = Deno.readTextFileSync(f).split(/\r?\n/), names: string[] = [], tris: Tri[] = []
  for (let i = L.indexOf("nodes") + 1; L[i].trim() !== "end"; i++) { const m = L[i].match(/^\s*(\d+)\s+"([^"]+)"/); if (m) names[+m[1]] = m[2] }
  const t = L.indexOf("triangles")
  for (let i = t + 1; i < L.length && L[i].trim() !== "end"; i += 4) {
    tris.push({ mat: L[i].trim(), v: [1, 2, 3].map((k) => { const p = L[i + k].trim().split(/\s+/), n = p.map(Number); return { bone: n[0], p: [n[1], n[2], n[3]] as V3, n: [n[4], n[5], n[6]] as V3, rest: p.slice(7) } }) })
  }
  return { names, tris, header: L.slice(0, t + 1) }
}
const side = (bone: string) => /_L_|L$/.test(bone) ? "L" : /_R_|R$/.test(bone) ? "R" : ""
const hand = (bone: string) => /_(Hand|Finger)/.test(bone)
const mean = (P: V3[]) => P.reduce((a, p) => [a[0] + p[0] / P.length, a[1] + p[1] / P.length, a[2] + p[2] / P.length] as V3, [0, 0, 0] as V3)
const app = (R: number[][], p: V3): V3 => [0, 1, 2].map((i) => R[i][0] * p[0] + R[i][1] * p[1] + R[i][2] * p[2]) as V3
const d2 = (a: V3, b: V3) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
// rotation R and translation T with R*src+T closest to dst (Kabsch)
const kabsch = (src: V3[], dst: V3[]) => {
  const cs = mean(src), cd = mean(dst), H = Matrix.zeros(3, 3)
  src.forEach((s, k) => { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) H.set(i, j, H.get(i, j) + (s[i] - cs[i]) * (dst[k][j] - cd[j])) })
  const svd = new SingularValueDecomposition(H), U = svd.leftSingularVectors, V = svd.rightSingularVectors
  const d = Math.sign(determinant(V.mmul(U.transpose()))) || 1
  const R = V.mmul(Matrix.diag([1, 1, d])).mmul(U.transpose()).to2DArray(), rc = app(R, cs)
  return { R, T: [cd[0] - rc[0], cd[1] - rc[1], cd[2] - rc[2]] as V3 }
}
// fits donor points onto target points: each target point pulls the nearest moved donor point
const icp = (donor: V3[], target: V3[]) => {
  const c0 = mean(donor), c1 = mean(target)
  let R = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], T: V3 = [c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]], rms = 0
  for (let it = 0; it < 60; it++) {
    const moved = donor.map((p) => { const q = app(R, p); return [q[0] + T[0], q[1] + T[1], q[2] + T[2]] as V3 })
    const pairs = target.map((t) => { let b = 0; for (let k = 1; k < moved.length; k++) if (d2(moved[k], t) < d2(moved[b], t)) b = k; return b })
    rms = Math.sqrt(target.reduce((a, t, k) => a + d2(moved[pairs[k]], t), 0) / target.length)
    ;({ R, T } = kabsch(pairs.map((k) => donor[k]), target))
  }
  return { R, T, rms }
}
const [w, donorName] = Deno.args
const ref = (n: string) => { const d = `hl2/w/${n}/dec`, q = Deno.readTextFileSync(`${d}/${Deno.readDirSync(d).find((e) => e.name.endsWith(".qc"))!.name}`); return `${d}/${q.match(/\$bodygroup "studio"\s*\{\s*studio "([^"]+)"/)![1]}` }
const tgt = parse(ref(w)), don = parse(ref(donorName)), arms = parse(`hl2/w/${donorName}/build/nike_arms_w.smd`)
const isHand = (t: Tri) => t.mat.toLowerCase() === "v_hand_sheet"
// sides with no arm bones in the viewmodel, and the hand mesh off the arm bones that stands in for them
const missing = ["L", "R"].filter((s) => !tgt.names.some((n) => n.includes(`Bip01_${s}_Hand`)))
const tv = tgt.tris.filter(isHand).flatMap((t) => t.v).filter((v) => { const n = tgt.names[v.bone], m = n.match(/_([LR])_|([LR])\d*$/); return !n.includes("Bip01_") && (!m || missing.includes(m[1] ?? m[2])) })
if (!missing.length || !tv.length) Deno.exit(0)
const dst = `hl2/w/${w}/build/nike_arms_w.smd`, merged = Deno.readTextFileSync(dst).trimEnd().split("\n")
if (parse(dst).names.join() !== tgt.names.join()) throw new Error(`${dst} skeleton differs from the reference`)
const dHand = (s: string) => don.tris.filter(isHand).flatMap((t) => t.v).filter((v) => side(don.names[v.bone]) === s && hand(don.names[v.bone])).map((v) => v.p)
const sideOfVert: (p: V3) => string = (() => {
  if (missing.length === 1) return () => missing[0]
  // both hands: 2-means from the two farthest points; the left hand is the cluster further along the donor's right-to-left direction
  const far = (p: V3) => tv.reduce((b, v) => d2(v.p, p) > d2(b.p, p) ? v : b).p
  let cs = [far(tv[0].p)]
  cs.push(far(cs[0]))
  const near = (p: V3) => d2(p, cs[0]) < d2(p, cs[1]) ? 0 : 1
  for (let it = 0; it < 20; it++) cs = [0, 1].map((k) => mean(tv.filter((v) => near(v.p) === k).map((v) => v.p)))
  const dl = mean(dHand("L")), dr = mean(dHand("R")), along = (p: V3) => (p[0] - dr[0]) * (dl[0] - dr[0]) + (p[1] - dr[1]) * (dl[1] - dr[1]) + (p[2] - dr[2]) * (dl[2] - dr[2])
  const left = along(cs[0]) > along(cs[1]) ? 0 : 1
  return (p: V3) => near(p) === left ? "L" : "R"
})()
const out = merged.slice(0, -1)
for (const s of missing) {
  const all = tv.filter((v) => sideOfVert(v.p) === s), dp = dHand(s)
  if (!all.length || !dp.length) { console.log(s, "hand: none"); continue }
  // fit and skin to the bone carrying most of that hand (the 357 hand bone, not its forearm bone)
  const counts = new Map<number, number>(); for (const v of all) counts.set(v.bone, (counts.get(v.bone) ?? 0) + 1)
  const bone = [...counts].sort((a, b) => b[1] - a[1])[0][0], tp = all.filter((v) => v.bone === bone), { R, T, rms } = icp(dp, tp.map((v) => v.p))
  const mine = arms.tris.filter((t) => side(arms.names[t.v[0].bone]) === s)
  for (const t of mine) {
    out.push(t.mat)
    for (const v of t.v) { const p = app(R, v.p), n = app(R, v.n); out.push(`${bone} ${p[0] + T[0]} ${p[1] + T[1]} ${p[2] + T[2]} ${n.join(" ")} ${v.rest.slice(0, 2).join(" ")}`) }
  }
  console.log(s, "hand:", tp.length, "verts on", tgt.names[bone], "fit rms", rms.toFixed(2), "arm tris", mine.length)
}
Deno.writeTextFileSync(dst, out.concat("end", "").join("\n"))
