// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: retarget.ts <mode> <tgt.qc> <mapfile.json|-> <outDir> <in.smd...>
// mode "arms": output skeleton = target definebone skeleton; source bones map to target bones by name table
// mode "merge": like "arms" with the bones matched by name, case-insensitively and ignoring a model prefix, and moved rigidly, as
// Source's bonemerge places them
// mode "pose": output skeleton = source skeleton and lengths; same-named bones take the target rest rotation, arm chain swings onto the target direction
type V = [number, number, number]
type M = [V, V, V]
const I3: M = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
const mul = (a: M, b: M): M => a.map((r) => [0, 1, 2].map((j) => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j])) as M
const tr = (a: M): M => [0, 1, 2].map((i) => [a[0][i], a[1][i], a[2][i]]) as M
const app = (a: M, v: V): V => a.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]) as V
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const eul = ([x, y, z]: V): M => {
  const sr = Math.sin(x), cr = Math.cos(x), sp = Math.sin(y), cp = Math.cos(y), sy = Math.sin(z), cy = Math.cos(z)
  return [[cp * cy, sr * sp * cy - cr * sy, cr * sp * cy + sr * sy], [cp * sy, sr * sp * sy + cr * cy, cr * sp * sy - sr * cy], [-sp, sr * cp, cr * cp]]
}
const toEul = (m: M): V => {
  const sp = -m[2][0], y = Math.asin(Math.max(-1, Math.min(1, sp)))
  if (Math.abs(sp) > 0.99999) return [0, y, Math.atan2(-m[0][1], m[1][1])]
  return [Math.atan2(m[2][1], m[2][2]), y, Math.atan2(m[1][0], m[0][0])]
}
const rad = (d: number) => d * Math.PI / 180
type Bone = { name: string; parent: string; pos: V; rot: V }
type W = { R: M; p: V }
const [mode, qcPath, mapPath, outDir, ...inputs] = Deno.args
const map: Record<string, string> = mapPath === "-" ? {} : JSON.parse(Deno.readTextFileSync(mapPath))
const worlds = (bs: Bone[]): W[] => {
  const idx = new Map(bs.map((b, i) => [b.name, i])), out: W[] = []
  const get = (i: number): W => {
    if (out[i]) return out[i]
    const b = bs[i], l = eul(b.rot)
    if (b.parent === "") return out[i] = { R: l, p: b.pos }
    const P = get(idx.get(b.parent)!)
    return out[i] = { R: mul(P.R, l), p: add(P.p, app(P.R, b.pos)) }
  }
  return bs.map((_, i) => get(i))
}
const localsOf = (bs: Bone[], w: W[]): Bone[] => bs.map((b, i) => {
  const pi = b.parent === "" ? -1 : bs.findIndex((x) => x.name === b.parent)
  return pi < 0 ? { ...b, pos: w[i].p, rot: toEul(w[i].R) } : { ...b, pos: app(tr(w[pi].R), sub(w[i].p, w[pi].p)), rot: toEul(mul(tr(w[pi].R), w[i].R)) }
})
type Vert = { b: number; p: V; n: V; uv: [number, number]; links: [number, number][] }
const parse = (txt: string) => {
  const L = txt.split(/\r?\n/), nodes: { id: number; name: string; parent: number }[] = [], raw = new Map<number, V[]>(), tris: { mat: string; verts: Vert[] }[] = []
  let i = 0; while (L[i].trim() !== "nodes") i++
  for (i++; L[i].trim() !== "end"; i++) { const m = L[i].trim().match(/^(\d+)\s+"([^"]*)"\s+(-?\d+)/)!; nodes.push({ id: +m[1], name: m[2], parent: +m[3] }) }
  while (L[i].trim() !== "skeleton") i++
  for (i++; !/^time 0\b/.test(L[i].trim()); i++);
  for (i++; !/^(time|end)/.test(L[i].trim()); i++) { const n = L[i].trim().split(/\s+/).map(Number); raw.set(n[0], [[n[1], n[2], n[3]], [n[4], n[5], n[6]]]) }
  const skel: Bone[] = nodes.map((n) => ({ name: n.name, parent: n.parent < 0 ? "" : nodes.find((x) => x.id === n.parent)!.name, pos: raw.get(n.id)![0], rot: raw.get(n.id)![1] }))
  while (i < L.length && L[i].trim() !== "triangles") i++
  for (i++; i < L.length && L[i].trim() !== "end"; i += 4) {
    const verts = [1, 2, 3].map((k) => {
      const t = L[i + k].trim().split(/\s+/).map(Number), nl = t[9] ?? 0, links: [number, number][] = []
      for (let j = 0; j < nl; j++) links.push([t[10 + 2 * j], t[11 + 2 * j]])
      return { b: t[0], p: [t[1], t[2], t[3]] as V, n: [t[4], t[5], t[6]] as V, uv: [t[7], t[8]] as [number, number], links }
    })
    tris.push({ mat: L[i].trim(), verts })
  }
  return { nodes, skel, tris }
}
const fmt = (v: number) => v.toFixed(6)
// minimal rotation taking direction a onto direction b (Rodrigues)
const swing = (a: V, b: V): M => {
  const na = Math.hypot(...a), nb = Math.hypot(...b), x = a.map((v) => v / na) as V, y = b.map((v) => v / nb) as V
  const k: V = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]], c = x[0] * y[0] + x[1] * y[1] + x[2] * y[2]
  if (c < -0.9999) return I3
  const K: M = [[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]], K2 = mul(K, K), f = 1 / (1 + c)
  return [0, 1, 2].map((r) => [0, 1, 2].map((j) => (r === j ? 1 : 0) + K[r][j] + K2[r][j] * f)) as M
}
const tgt: Bone[] = qcPath.endsWith(".smd") ? parse(Deno.readTextFileSync(qcPath)).skel : [...Deno.readTextFileSync(qcPath).matchAll(/^\$definebone\s+"([^"]*)"\s+"([^"]*)"\s+(.+)$/gm)].map((m) => {
  const n = m[3].trim().split(/\s+/).map(Number)
  return { name: m[1], parent: m[2], pos: [n[0], n[1], n[2]] as V, rot: [rad(n[3]), rad(n[4]), rad(n[5])] as V }
})
const tIdx = new Map(tgt.map((b, i) => [b.name, i])), tW = worlds(tgt)
await Deno.mkdir(outDir, { recursive: true })
for (const f of inputs) {
  const P = parse(await Deno.readTextFile(f)), sW = worlds(P.skel), sIdx = new Map(P.skel.map((b, i) => [b.name, i]))
  let outBones: Bone[], outIdx: number[], Mt: { R: M; t: V; A?: M }[]
  const twistOf = new Map<number, { knots: [number, number][]; p0: V; u: V; ls: number }>()
  const merge = mode === "merge"
  if (merge) {
    // a name with no exact match falls back to the part after the model prefix (Crossbow_model.Bip01_L_Hand), when unique
    const low = new Map(tgt.map((b) => [b.name.toLowerCase(), b.name])), base = (n: string) => n.toLowerCase().replace(/^.*\./, "")
    const bare = new Map<string, string | null>(); for (const b of tgt) bare.set(base(b.name), bare.has(base(b.name)) ? null : b.name)
    for (const b of P.skel) { const t = low.get(b.name.toLowerCase()) ?? bare.get(base(b.name)); if (t) map[b.name] = t }
  }
  if (mode === "arms" || merge) {
    outBones = tgt
    const prim = new Map<string, number>(); P.skel.forEach((b, i) => { const t = map[b.name]; if (t !== undefined && tIdx.has(t)) prim.set(t, i) })
    const frame = P.skel.map((_, i) => { let c = i; while (c >= 0 && !(map[P.skel[c].name] !== undefined && tIdx.has(map[P.skel[c].name]))) c = sIdx.get(P.skel[c].parent) ?? -1; return c < 0 ? -1 : prim.get(map[P.skel[c].name])! })
    // merge: a bone of one arm never falls back to a bone off that arm (the other arm of a one-handed rig whose spine is in the target)
    const sideOf = (n: string) => n.match(/_([LR])_/)?.[1]
    outIdx = frame.map((s, i) => s < 0 || (merge && sideOf(P.skel[i].name) && sideOf(P.skel[i].name) !== sideOf(P.skel[s].name)) ? -1 : tIdx.get(map[P.skel[s].name])!)
    // roll about the limb axis: pick the one that best aligns finger spread of the source hand with the target hand
    const sideQ: Record<string, M> = {}
    for (const side of ["L", "R"]) {
      const hand = P.skel.findIndex((b) => new RegExp("_" + side + "_Hand$").test(b.name)); if (hand < 0) continue
      const pairs = P.skel.filter((b) => b.parent === P.skel[hand].name && map[b.name] !== undefined && tIdx.has(map[b.name])).map((b) => [b.pos, tgt[tIdx.get(map[b.name])!].pos] as [V, V])
      const mean = (vs: V[]): V => [0, 1, 2].map((k) => vs.reduce((a, v) => a + v[k], 0) / vs.length) as V
      const mu = mean(pairs.map((p) => p[0])), mv = mean(pairs.map((p) => p[1]))
      let best = I3, bs = -1e9
      for (let k = 0; k < 4; k++) {
        const c = Math.cos(k * Math.PI / 2), sn = Math.sin(k * Math.PI / 2), Q: M = [[1, 0, 0], [0, c, -sn], [0, sn, c]]
        const sc = pairs.reduce((a, [u, v]) => { const q = app(Q, sub(u, mu)), d = sub(v, mv); return a + q[0] * d[0] + q[1] * d[1] + q[2] * d[2] }, 0)
        if (sc > bs) { bs = sc; best = Q }
      }
      sideQ[side] = best; console.log("hand roll", side, JSON.stringify(best.map((r) => r.map(Math.round))))
    }
    // keep the source arm's proportions: one uniform scale per arm fits its upper arm + forearm length to the rig,
    // and the upper arm and forearm stretch slightly along their axis so the elbow and wrist land on the rig joints
    const sb = (n: string) => sIdx.get(`ValveBiped.Bip01_${n}`), seg = (side: string, a: string, b: string) => {
      const sa = sb(`${side}_${a}`), sc = sb(`${side}_${b}`); if (sa === undefined || sc === undefined || !tIdx.has(map[P.skel[sa].name]) || !tIdx.has(map[P.skel[sc].name])) return undefined
      const d = sub(sW[sc].p, sW[sa].p), ls = Math.hypot(...d)
      return { ls, lt: Math.hypot(...sub(tW[tIdx.get(map[P.skel[sc].name])!].p, tW[tIdx.get(map[P.skel[sa].name])!].p)), u: d.map((x) => x / ls) as V }
    }
    const armK: Record<string, number> = {}
    for (const side of ["L", "R"]) {
      const up = seg(side, "UpperArm", "Forearm"), fo = seg(side, "Forearm", "Hand")
      if (up && fo) { armK[side] = (up.lt + fo.lt) / (up.ls + fo.ls); console.log("arm scale", side, armK[side].toFixed(3)) }
    }
    const armScale = (side: string, name: string): M => {
      const k = armK[side] ?? 1, m = name.match(/_(UpperArm|Forearm)$/), sg = m && seg(side, m[1], m[1] === "UpperArm" ? "Forearm" : "Hand")
      const a = sg ? sg.lt / sg.ls / k : 1, u = sg ? sg.u : [1, 0, 0] as V
      return [0, 1, 2].map((r) => [0, 1, 2].map((c) => k * ((r === c ? 1 : 0) + (a - 1) * u[r] * u[c]))) as M
    }
    // forearm weights spread by position from the elbow (0) to the wrist (1) over bones that take part of the wrist roll:
    // the forearm and its twist bone animated by twistbake.ts, or the rig's own animated ForeTwist chain at its joints
    for (const side of ["L", "R"]) {
      const fo = seg(side, "Forearm", "Hand"), t = tIdx.get(`SCI_Hand_Forearm_${side}`)
      const f = tIdx.get(map[`ValveBiped.Bip01_${side}_Forearm`]), h = tIdx.get(map[`ValveBiped.Bip01_${side}_Hand`])
      if (!fo || f === undefined || h === undefined) continue
      const d = sub(tW[h].p, tW[f].p), at = (i: number) => { const e = sub(tW[i].p, tW[f].p); return (e[0] * d[0] + e[1] * d[1] + e[2] * d[2]) / (fo.lt * fo.lt) }
      const chain = tgt.flatMap((b, i) => new RegExp(` ${side} ForeTwist\\d*$`).test(b.name) ? [[i, at(i)] as [number, number]] : []).sort((a, b) => a[1] - b[1])
      const knots: [number, number][] = t !== undefined ? [[f, 0], [t, 1]] : chain
      if (knots.length && !merge) twistOf.set(sb(`${side}_Forearm`)!, { knots, p0: sW[sb(`${side}_Forearm`)!].p, ...fo })
    }
    // the arm bones do not share the hand's roll convention: they take the roll (in the same steps) that leaves the least rotation
    // between the forearm and the hand, so the mesh carries no twist at the wrist and the elbow keeps its bend direction
    const rollQ = (k: number): M => { const c = Math.round(Math.cos(k * Math.PI / 2)), sn = Math.round(Math.sin(k * Math.PI / 2)); return [[1, 0, 0], [0, c, -sn], [0, sn, c]] }
    const frameR = (s: number, Q: M): M => mul(mul(tW[tIdx.get(map[P.skel[s].name])!].R, Q), tr(sW[s].R))
    const armQ: Record<string, M> = {}
    for (const side of ["L", "R"]) {
      const f = sb(`${side}_Forearm`), h = sb(`${side}_Hand`)
      if (f === undefined || h === undefined || !tIdx.has(map[P.skel[f].name]) || !tIdx.has(map[P.skel[h].name])) continue
      const Rh = frameR(h, sideQ[side] ?? I3), off = (Q: M) => { const m = mul(tr(frameR(f, Q)), Rh); return m[0][0] + m[1][1] + m[2][2] }
      armQ[side] = [0, 1, 2, 3].map(rollQ).reduce((a, b) => off(b) > off(a) ? b : a)
      console.log("arm roll", side, JSON.stringify(armQ[side]), "wrist offset", (Math.acos(Math.max(-1, Math.min(1, (off(armQ[side]) - 1) / 2))) * 180 / Math.PI).toFixed(1))
    }
    const rotOf = (s: number): M => {
      const side = /_L_/.test(P.skel[s].name) ? "L" : "R"
      return frameR(s, (/_(Clavicle|UpperArm|Forearm)$/.test(P.skel[s].name) ? armQ[side] : undefined) ?? sideQ[side] ?? I3)
    }
    Mt = frame.map((s, i) => {
      if (s < 0 || outIdx[i] < 0) return { R: I3, t: [0, 0, 0] as V }
      if (merge) { const R = frameR(s, I3); return { R, t: sub(tW[outIdx[i]].p, app(R, sW[s].p)) } }
      const side = /_L_/.test(P.skel[s].name) ? "L" : "R", R = rotOf(s), A = mul(R, armScale(side, P.skel[s].name))
      return { R, A, t: sub(tW[outIdx[i]].p, app(A, sW[s].p)) }
    })
  } else {
    const D: M[] = [], A: M[] = [], nW: W[] = [], done = new Set<number>()
    const go = (i: number) => {
      if (done.has(i)) return; done.add(i)
      const b = P.skel[i], pi = sIdx.get(b.parent) ?? -1
      if (pi >= 0) go(pi)
      const t = tIdx.get(b.name)
      if (t !== undefined) {
        // world-space swing that turns the source bone direction (to its longest mapped child) onto the target's, on top of the parent's;
        // only the arm chain swings (T-pose source vs A-pose target), torso and legs already match and keep their shape
        const Dp = pi >= 0 ? D[pi] : I3
        const kids = P.skel.filter((c) => c.parent === b.name && tIdx.has(c.name) && tgt[tIdx.get(c.name)!].parent === b.name).sort((a, c) => Math.hypot(...c.pos) - Math.hypot(...a.pos))
        D[i] = Dp
        if (kids.length && Math.hypot(...kids[0].pos) >= 1 && /_(Clavicle|UpperArm|Forearm|Hand|Finger\d+)$/.test(b.name)) {
          const c = sIdx.get(kids[0].name)!, tc = tIdx.get(kids[0].name)!
          D[i] = mul(swing(app(Dp, sub(sW[c].p, sW[i].p)), sub(tW[tc].p, tW[t].p)), Dp)
        }
        // target rest rotation, source proportions (bone lengths); the model's proportions delta sequence restores them over the target anims
        A[i] = D[i]
        nW[i] = { R: tW[t].R, p: pi >= 0 ? add(nW[pi].p, app(D[pi], sub(sW[i].p, sW[pi].p))) : sW[i].p }
        return
      }
      D[i] = pi >= 0 ? D[pi] : I3; A[i] = pi >= 0 ? A[pi] : I3
      nW[i] = { R: mul(D[i], sW[i].R), p: pi >= 0 ? add(nW[pi].p, app(A[pi], sub(sW[i].p, sW[pi].p))) : sW[i].p }
    }
    P.skel.forEach((_, i) => go(i))
    if (Deno.env.get("DEBUG")) P.skel.forEach((b, i) => { if (tIdx.has(b.name)) console.log(b.name, (Math.acos(Math.max(-1, Math.min(1, (D[i][0][0] + D[i][1][1] + D[i][2][2] - 1) / 2))) * 180 / Math.PI).toFixed(1)) })
    outBones = localsOf(P.skel, nW)
    outIdx = P.skel.map((_, i) => i)
    Mt = P.skel.map((_, i) => ({ R: D[i], A: A[i], t: sub(nW[i].p, app(A[i], sW[i].p)) }))
  }
  const oLoc = mode === "arms" ? outBones : outBones
  const lines = ["version 1", "nodes", ...outBones.map((b, i) => `  ${i} "${b.name}" ${b.parent === "" ? -1 : outBones.findIndex((x) => x.name === b.parent)}`), "end", "skeleton", "time 0"]
  oLoc.forEach((b, i) => lines.push(`${i} ${[...b.pos, ...b.rot].map(fmt).join(" ")}`))
  lines.push("end", "triangles")
  const idOf = new Map(P.nodes.map((n, i) => [n.id, i])); let unmapped = 0, dropped = 0
  for (const t of P.tris) {
    const tl = [t.mat]
    for (const v of t.verts) {
      const acc = new Map<number, number>(); let pos: V = [0, 0, 0], nrm: V = [0, 0, 0], tw = 0
      for (const [b, w] of v.links.length ? v.links : [[v.b, 1] as [number, number]]) {
        const si = idOf.get(b)!, o = outIdx[si]; if (o < 0) { unmapped++; continue }
        const tb = twistOf.get(si), put = (b: number, x: number) => x > 0 && acc.set(b, (acc.get(b) ?? 0) + x)
        if (tb) {
          const d = sub(v.p, tb.p0), r = (d[0] * tb.u[0] + d[1] * tb.u[1] + d[2] * tb.u[2]) / tb.ls, k = tb.knots, j = k.findIndex((x) => x[1] > r)
          if (j <= 0) put(k.at(j)![0], w)
          else { const s = (r - k[j - 1][1]) / (k[j][1] - k[j - 1][1]); put(k[j - 1][0], w * (1 - s)); put(k[j][0], w * s) }
        } else acc.set(o, (acc.get(o) ?? 0) + w)
        tw += w
        const m = Mt[si], q = add(app(m.A ?? m.R, v.p), m.t), n = app(m.R, v.n)
        pos = add(pos, [q[0] * w, q[1] * w, q[2] * w]); nrm = add(nrm, [n[0] * w, n[1] * w, n[2] * w])
      }
      // arms and merge modes: a vertex with no bone in the target (the other arm of a one-handed rig) drops its triangle
      if (tw === 0) { if (mode !== "pose") break; acc.set(0, 1); tw = 1; pos = v.p; nrm = v.n }
      const len = Math.hypot(...nrm) || 1, main = [...acc].sort((a, b) => b[1] - a[1])[0][0]
      tl.push(`${main} ${pos.map((x) => fmt(x / tw)).join(" ")} ${nrm.map((x) => fmt(x / len)).join(" ")} ${fmt(v.uv[0])} ${fmt(v.uv[1])} ${acc.size} ${[...acc].map(([b, w]) => `${b} ${fmt(w / tw)}`).join(" ")}`)
    }
    if (tl.length === 4) lines.push(...tl); else dropped++
  }
  lines.push("end")
  await Deno.writeTextFile(`${outDir}/${f.split("/").pop()}`, lines.join("\n") + "\n")
  console.log(f.split("/").pop(), "tris", P.tris.length, "bones", outBones.length, "unmapped links", unmapped, "dropped tris", dropped)
}
