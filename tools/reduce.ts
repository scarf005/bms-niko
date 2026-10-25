// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: reduce.ts <srcDir> <dstDir> <keepPrefix> [maxBones]; rewrites every .smd under srcDir keeping bones named with keepPrefix plus, up to maxBones in total, the other bones with the heaviest vertex-weight subtrees (parent kept first)
const [src, dst, prefix, maxArg] = Deno.args
type Node = { id: number; name: string; parent: number }
const readNodes = (lines: string[]) => {
  const nodes: Node[] = []
  for (let i = lines.indexOf("nodes") + 1; lines[i] !== "end"; i++) {
    const m = lines[i].match(/^\s*(\d+)\s+"([^"]+)"\s+(-?\d+)/)!
    nodes.push({ id: +m[1], name: m[2], parent: +m[3] })
  }
  return nodes
}
const files: string[] = []
const walk = async (d: string) => { for await (const e of Deno.readDir(d)) e.isDirectory ? await walk(`${d}/${e.name}`) : e.name.endsWith(".smd") && files.push(`${d}/${e.name}`) }
await walk(src)
const ref = files.find((f) => f.endsWith("/face.smd"))!
const refNodes = readNodes((await Deno.readTextFile(ref)).split(/\r?\n/))
const byId = new Map(refNodes.map((n) => [n.id, n]))
const vw = new Map<number, number>()
const addW = async (f: string) => {
  const L = (await Deno.readTextFile(f)).split(/\r?\n/), t = L.indexOf("triangles")
  if (t < 0 || f.endsWith("_physics.smd")) return
  for (let i = t + 1; L[i] !== "end" && i < L.length; i += 4) for (let k = 1; k <= 3; k++) {
    const p = L[i + k].trim().split(/\s+/)
    if (p.length > 9) for (let j = 0; j < +p[9]; j++) vw.set(+p[10 + 2 * j], (vw.get(+p[10 + 2 * j]) ?? 0) + +p[11 + 2 * j])
    else vw.set(+p[0], (vw.get(+p[0]) ?? 0) + 1)
  }
}
for (const f of files) await addW(f)
const sub = new Map<number, number>()
for (const n of refNodes) { let a: number = n.id; while (a >= 0) { sub.set(a, (sub.get(a) ?? 0) + (vw.get(n.id) ?? 0)); a = byId.get(a)!.parent } }
const keepIds = new Set(refNodes.filter((n) => n.name.startsWith(prefix)).map((n) => n.id))
const extra = refNodes.filter((n) => !keepIds.has(n.id) && (sub.get(n.id) ?? 0) > 0).sort((a, b) => sub.get(b.id)! - sub.get(a.id)!)
for (let added = true; added && keepIds.size < +(maxArg ?? 0); ) {
  added = false
  for (const n of extra) if (!keepIds.has(n.id) && keepIds.has(n.parent) && keepIds.size < +maxArg) { keepIds.add(n.id); added = true; break }
}
const keptNames = refNodes.filter((n) => keepIds.has(n.id)).map((n) => n.name)
const newIndex = new Map(keptNames.map((n, i) => [n, i]))
const kept = refNodes.filter((n) => newIndex.has(n.name))
const nearestKept = (id: number): number => { let n = byId.get(id)!; while (!newIndex.has(n.name)) n = byId.get(n.parent)!; return newIndex.get(n.name)! }
const newParent = (n: Node) => { let p = n.parent; while (p >= 0 && !newIndex.has(byId.get(p)!.name)) p = byId.get(p)!.parent; return p < 0 ? -1 : newIndex.get(byId.get(p)!.name)! }
const nodesBlock = ["nodes", ...kept.map((n) => `  ${newIndex.get(n.name)} "${n.name}" ${newParent(n)}`), "end"]
const keptIds = new Set(kept.map((n) => n.id))
console.log("kept bones:", kept.length, "of", refNodes.length)
let dropped = 0
for (const f of files) {
  const lines = (await Deno.readTextFile(f)).split(/\r?\n/)
  const isPhys = f.endsWith("_physics.smd")
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const l = lines[i]
    if (l === "nodes") { out.push(...nodesBlock); while (lines[i] !== "end") i++; i++; continue }
    if (l === "skeleton") {
      out.push(l); i++
      for (; lines[i] !== "end"; i++) {
        const t = lines[i].trim().split(/\s+/)
        if (t[0] === "time") out.push(lines[i])
        else if (keptIds.has(+t[0])) out.push(`  ${newIndex.get(byId.get(+t[0])!.name)} ${t.slice(1).join(" ")}`)
      }
      out.push("end"); i++; continue
    }
    if (l === "triangles") {
      out.push(l); i++
      for (; lines[i] !== "end" && i < lines.length; i += 4) {
        const tri = [lines[i + 1], lines[i + 2], lines[i + 3]].map((v) => v.trim().split(/\s+/))
        if (isPhys && tri.some((t) => !keptIds.has(+t[0]))) { dropped++; continue }
        out.push(lines[i])
        for (const t of tri) {
          const head = t.slice(1, 9).join(" ")
          if (t.length > 9) {
            const n = +t[9], acc = new Map<number, number>()
            for (let k = 0; k < n; k++) { const b = nearestKept(+t[10 + 2 * k]); acc.set(b, (acc.get(b) ?? 0) + +t[11 + 2 * k]) }
            const tot = [...acc.values()].reduce((a, b) => a + b, 0) || 1
            const links = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 3)
            const s = links.reduce((a, [, w]) => a + w, 0) || 1
            out.push(`  ${links[0][0]} ${head} ${links.length} ${links.map(([b, w]) => `${b} ${(w / s).toFixed(6)}`).join(" ")}`)
            void tot
          } else out.push(`  ${isPhys ? newIndex.get(byId.get(+t[0])!.name) : nearestKept(+t[0])} ${head}`)
        }
      }
      out.push("end"); i++; continue
    }
    out.push(l); i++
  }
  const dstF = f.replace(src, dst)
  await Deno.mkdir(dstF.slice(0, dstF.lastIndexOf("/")), { recursive: true })
  await Deno.writeTextFile(dstF, out.join("\n"))
}
console.log("physics triangles dropped:", dropped)
