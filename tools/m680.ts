// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: m680.ts <bms|hl2> <game v_shotgun.qc> <game w_shotgun.qc> <arms.smd> <outDir> <materialRoot...>
// builds v_shotgun and w_shotgun QC dirs (<outDir>, <outDir>/w) from the MW2019 Model 680 (Viper's mg_romeo870), decompiled under
// m680/dec: the default parts and the Corp Combat Holo sight, bonemerged onto the MW skeleton as mg_base does at runtime.
// viewmodel: the Niko arms bonemerged onto its ValveBiped helper bones, the skeleton cut to the bones they use, and the game's own
// sequences, activities and events played with the matching MW animation.
// world model: the parts moved from the MW hand frame onto the game's w_shotgun barrel, on the game's skeleton, sequences and physics.
// Materials and their textures are copied into <outDir>/materials, without the Garry's Mod proxies.
import { filterArms } from "./armsfilter.ts"
const [game, gameQc, gameWQc, armsSmd, out, ...matRoots] = Deno.args
const T = new URL(".", import.meta.url).pathname, V = "m680/dec/v/dec", A = "m680/dec/att"
const run = (script: string, args: string[]) => {
  const r = new Deno.Command("deno", { args: ["run", "-A", `${T}${script}`, ...args] }).outputSync()
  if (!r.success) throw new Error(`${script}: ${new TextDecoder().decode(r.stderr)}`)
  return new TextDecoder().decode(r.stdout)
}
const gunParts = [
  `${A}/attachment_vm_sh_romeo870_receiver/dec/attachment_vm_sh_romeo870_receiver.smd`,
  `${A}/attachment_vm_sh_romeo870_receiver/dec/attachment_vm_sh_romeo870_rail.smd`,
  `${A}/attachment_vm_sh_romeo870_receiver/dec/attachment_vm_sh_romeo870_stock.smd`,
  `${A}/attachment_vm_sh_romeo870_barrel/dec/attachment_vm_sh_romeo870_barrel.smd`,
  `${A}/attachment_vm_sh_romeo870_pump/dec/attachment_vm_sh_romeo870_pump.smd`,
  `${A}/attachment_vm_holo_west_lod0/dec/attachment_vm_holo_west_LOD0.smd`,
]
// the shells the left hand loads only exist in the viewmodel
const parts = [...gunParts, `${V}/attachment_vm_sh_romeo870_receiver_ammo.smd`]
// world model placement, fitted to the game's own w_shotgun: pitch (nose up, degrees) about the MW muzzle, then a half turn about
// the barrel (the game's hand bone frame has z pointing down from the gun), then pos in that frame, which puts the pistol grip
// and the barrel line on the original's
const place = game === "bms" ? { pos: [5.4, -3.1, -4.23], pitch: 0 } : { pos: [6, -1, -7.2], pitch: 6 }
// game activity -> MW sequence; activities not listed play idle
const anim: Record<string, string> = {
  ACT_VM_FIDGET: "inspect", ACT_VM_PRIMARYATTACK: "fire", ACT_VM_SECONDARYATTACK: "fire", ACT_RANGE_ATTACK_SHOTGUN: "fire",
  ACT_VM_DRAW: "draw", ACT_VM_PICKUP: "draw_first", ACT_VM_HOLSTER: "holster", ACT_SHOTGUN_PUMP: "rechamber",
  ACT_SHOTGUN_RELOAD_START: "reload_start", ACT_VM_RELOAD: "reload_loop", ACT_SHOTGUN_RELOAD_FINISH: "reload_end",
  ACT_VM_IDLE_LOWERED: "a_sprint", ACT_VM_SPRINT_IDLE: "a_sprint",
}
const tmp = `${out}/merged`
await Deno.mkdir(tmp, { recursive: true })
Deno.writeTextFileSync(`${tmp}/nike_arms_src.smd`, filterArms(Deno.readTextFileSync(armsSmd)))
run("retarget.ts", ["merge", `${V}/v_romeo870.qc`, "-", tmp, ...parts, `${tmp}/nike_arms_src.smd`])
const q = Deno.readTextFileSync(gameQc).replaceAll("\r\n", "\n")
const seqs = [...q.matchAll(/^\$sequence "([^"]+)" \{\n([\s\S]*?)^\}/gm)].map((m) => ({ name: m[1], body: m[2] }))
const used = [...new Set(seqs.map((s) => anim[s.body.match(/activity "(\w+)"/)?.[1] ?? ""] ?? "idle"))]
const frames = (f: string) => Deno.readTextFileSync(f).split("\n").filter((l) => /^\s*time\s/.test(l)).length
const meshes = [...parts.map((p) => `${tmp}/${p.split("/").pop()}`), `${tmp}/nike_arms_src.smd`]
console.log(run("bake.ts", [out, "tag_flash,tag_brass", ...meshes, "--", ...used.map((a) => `${V}/v_romeo870_anims/${a}.smd`)]).trim())
// sequences: the game's names, activities, events and blending; the MW clip at 30 fps, events moved to the same share of its length
const gameDir = gameQc.slice(0, gameQc.lastIndexOf("/"))
const seqText = seqs.map((s) => {
  const a = anim[s.body.match(/activity "(\w+)"/)?.[1] ?? ""] ?? "idle", src = s.body.match(/^\s*"([^"]+\.smd)"/m)![1].replaceAll("\\", "/")
  const n0 = frames(`${gameDir}/${src}`), n1 = frames(`${out}/${a}.smd`), k = n0 > 1 ? (n1 - 1) / (n0 - 1) : 0
  const body = s.body.replace(/^\s*"[^"]+\.smd"\n/m, `\t"${a}.smd"\n`).replace(/\{ event (\S+) (\d+) /g, (_m, e, f) => `{ event ${e} ${Math.round(+f * k)} `)
    .replace(/^\s*fps .*\n/m, "\tfps 30\n").replace(/^\s*loop\n/m, "").replace(/(\tfps 30\n)/, a === "idle" || a === "a_sprint" ? "$1\tloop\n" : "$1")
  return `$sequence "${s.name}" {\n${body}}\n`
}).join("\n")
// world model: the parts on the MW world skeleton, whose hand bone sits at its origin, then into the game's hand bone frame and
// onto the bone the game's own mesh uses
type V3 = [number, number, number]; type M3 = [V3, V3, V3]
const mul = (a: M3, b: M3): M3 => a.map((r) => [0, 1, 2].map((j) => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j])) as M3
const tr = (a: M3): M3 => [0, 1, 2].map((i) => [a[0][i], a[1][i], a[2][i]]) as M3
const app = (a: M3, v: number[]): V3 => a.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]) as V3
const eul = ([x, y, z]: number[]): M3 => {
  const sr = Math.sin(x), cr = Math.cos(x), sp = Math.sin(y), cp = Math.cos(y), sy = Math.sin(z), cy = Math.cos(z)
  return [[cp * cy, sr * sp * cy - cr * sy, cr * sp * cy + sr * sy], [cp * sy, sr * sp * sy + cr * cy, cr * sp * sy - sr * cy], [-sp, sr * cp, cr * cp]]
}
// rest world transforms by bone name, from an SMD's nodes and first skeleton frame
const rest = (L: string[]) => {
  const name: string[] = [], par: number[] = [], W: { R: M3; p: V3 }[] = []
  let i = L.findIndex((l) => l.trim() === "nodes") + 1
  for (; L[i].trim() !== "end"; i++) { const m = L[i].trim().match(/^(\d+)\s+"([^"]*)"\s+(-?\d+)/)!; name[+m[1]] = m[2]; par[+m[1]] = +m[3] }
  for (i = L.findIndex((l) => l.trim() === "skeleton") + 2; !/^(time|end)/.test(L[i].trim()); i++) {
    const t = L[i].trim().split(/\s+/).map(Number), b = t[0], R = eul(t.slice(4, 7)), p = t.slice(1, 4) as V3, P = W[par[b]]
    W[b] = par[b] < 0 ? { R, p } : { R: mul(P.R, R), p: app(P.R, p).map((x, k) => x + P.p[k]) as V3 }
  }
  return { name, W, get: (re: RegExp) => W[name.findIndex((n) => re.test(n))] }
}
const wTmp = `${out}/w/merged`, wOut = `${out}/w`, wDir = gameWQc.slice(0, gameWQc.lastIndexOf("/"))
await Deno.mkdir(wTmp, { recursive: true })
run("retarget.ts", ["merge", `${A}/w_romeo870/dec/w_romeo870.qc`, "-", wTmp, ...gunParts])
let wq = Deno.readTextFileSync(gameWQc).replaceAll("\r\n", "\n")
const wRef = wq.match(/\$bodygroup "\w+"\s*\{\s*studio "([^"]+)"/)![1], gL = Deno.readTextFileSync(`${wDir}/${wRef}`).split(/\r?\n/), g = rest(gL)
const hand = g.get(/bip01_r_hand$/i), gt = gL.indexOf("triangles"), skin = +gL[gt + 2].trim().split(/\s+/)[0]
const mw = rest(Deno.readTextFileSync(`${wTmp}/${gunParts[0].split("/").pop()}`).split("\n"))
const a = -place.pitch * Math.PI / 180, Rp: M3 = [[Math.cos(a), 0, Math.sin(a)], [0, -1, 0], [Math.sin(a), 0, -Math.cos(a)]]
const f0 = mw.get(/^tag_flash$/).p, f1 = [f0[0], -f0[1], -f0[2]], toModel = (v: number[]) => app(hand.R, app(Rp, v.map((x, k) => x - f0[k])).map((x, k) => x + f1[k] + place.pos[k])).map((x, k) => x + hand.p[k]) as V3
const toBone = (b: { R: M3; p: V3 }, v: V3) => app(tr(b.R), v.map((x, k) => x - b.p[k]))
const head = gL.slice(0, gt)
const worldMeshes = gunParts.map((p) => {
  const name = p.split("/").pop()!, L = Deno.readTextFileSync(`${wTmp}/${name}`).split("\n"), o = [...head, "triangles"]
  for (let i = L.indexOf("triangles") + 1; i < L.length && L[i].trim() !== "end"; i += 4) {
    o.push(L[i].trim())
    for (let k = 1; k <= 3; k++) {
      const t = L[i + k].trim().split(/\s+/).map(Number), v = toModel(t.slice(1, 4)), n = app(hand.R, app(Rp, t.slice(4, 7)))
      o.push([skin, ...v.map((x) => x.toFixed(6)), ...n.map((x) => x.toFixed(6)), t[7], t[8], 0].join(" "))
    }
  }
  Deno.writeTextFileSync(`${wOut}/${name}`, o.concat("end", "").join("\n"))
  return `${wOut}/${name}`
})
// muzzle and shell ejection follow the new gun; the game's attachment names, bones and angles stay
const wAtt = (tag: string) => toModel(mw.get(new RegExp(`^${tag}$`)).p)
wq = wq.replace(/^\$attachment "([^"]+)" "([^"]+)" (\S+) (\S+) (\S+)/gm, (_m, n, b) => {
  const p = toBone(g.W[g.name.indexOf(b)], wAtt(n === "muzzle" ? "tag_flash" : "tag_brass"))
  return `$attachment "${n}" "${b}" ${p.map((x) => x.toFixed(2)).join(" ")}`
})
  .replace(/\$bodygroup "\w+"\s*\{[^}]*\}\n/, worldMeshes.map((m) => `$body "${m.split("/").pop()!.replace(/\.smd$/, "")}" "${m.split("/").pop()}"\n`).join(""))
  .replace(/\$lod \d+\s*\{[^}]*\}\n/g, "").replace(/\$texturegroup "skinfamilies"\s*\{[\s\S]*?\n\}\n/, "").replace(/^\$cdmaterials .*\n/gm, "")
for (const e of Deno.readDirSync(wDir)) if (!e.name.endsWith(".qc") && !/\.smd$/i.test(e.name) || /physics/i.test(e.name)) try { Deno.symlinkSync(Deno.realPathSync(`${wDir}/${e.name}`), `${wOut}/${e.name}`) } catch { /* exists */ }
// materials: each name used by the meshes, found under the material roots (first root wins); Garry's Mod proxies dropped, decimal
// commas fixed. Triangles of a material no root has (the ammo's _s overlay, which only Garry's Mod skins point at a real material) go.
const find = (rel: string) => matRoots.map((r) => `${r}/${rel}`).find((p) => { try { return Deno.statSync(p).isFile } catch { return false } })
const vmtIndex = new Map<string, string>()
const walk = (d: string, rel = "") => { for (const e of Deno.readDirSync(d)) e.isDirectory ? walk(`${d}/${e.name}`, `${rel}${e.name}/`) : e.name.endsWith(".vmt") && !vmtIndex.has(e.name.slice(0, -4).toLowerCase()) && vmtIndex.set(e.name.slice(0, -4).toLowerCase(), `${rel}${e.name}`) }
for (const r of matRoots) walk(`${r}/materials`)
const mats = new Set<string>(), missing = new Set<string>()
for (const p of [...meshes.map((f) => `${out}/${f.split("/").pop()}`), ...worldMeshes]) {
  const L = Deno.readTextFileSync(p).split("\n"), t = L.indexOf("triangles"), o = L.slice(0, t + 1)
  for (let i = t + 1; i < L.length && L[i] !== "end"; i += 4) if (vmtIndex.has(L[i].trim().toLowerCase())) { mats.add(L[i].trim()); o.push(...L.slice(i, i + 4)) } else missing.add(L[i].trim())
  Deno.writeTextFileSync(p, o.concat("end", "").join("\n"))
}
const cd = new Set<string>()
for (const m of mats) {
  const rel = vmtIndex.get(m.toLowerCase())!
  cd.add(rel.slice(0, rel.lastIndexOf("/") + 1))
  let vmt = Deno.readTextFileSync(find(`materials/${rel}`)!).replace(/\[([^\]]*)\]/g, (_m, s) => `[${s.replace(/(\d),(\d)/g, "$1.$2")}]`)
  const px = vmt.search(/"?Proxies"?\s*\{/)
  if (px >= 0) { let d = 0, i = vmt.indexOf("{", px); for (; i < vmt.length; i++) if (vmt[i] === "{") d++; else if (vmt[i] === "}" && --d === 0) break; vmt = vmt.slice(0, px) + vmt.slice(i + 1) }
  const dst = `${out}/materials/${rel}`
  await Deno.mkdir(dst.slice(0, dst.lastIndexOf("/")), { recursive: true })
  Deno.writeTextFileSync(dst, vmt)
  // every quoted value that names a texture under a root
  for (const t of vmt.matchAll(/"?\$?\w+"?\s+"([^"]+)"/g)) {
    const tex = `materials/${t[1].replaceAll("\\", "/").toLowerCase()}.vtf`, s = find(tex)
    if (!s) continue
    await Deno.mkdir(`${out}/${tex.slice(0, tex.lastIndexOf("/"))}`, { recursive: true })
    await Deno.copyFile(s, `${out}/${tex}`)
  }
}
const armsGroup = q.match(/\$bodygroup "arms"\s*\{([\s\S]*?)\n\}/)?.[1].match(/studio/g)?.length ?? 1
const qc = `$modelname "weapons/v_shotgun.mdl"
${meshes.slice(0, -1).map((m) => `$body "${m.split("/").pop()!.replace(/\.smd$/, "")}" "${m.split("/").pop()}"`).join("\n")}
$bodygroup "arms"
{
${Array(armsGroup).fill('\tstudio "nike_arms_src.smd"').join("\n")}
}
$surfaceprop "default"
$contents "solid"
${[...cd].map((d) => `$cdmaterials "${d.replaceAll("/", "\\")}"`).join("\n")}
$attachment "muzzle" "tag_flash" 0 0 0 rotate 0 0 0
$attachment "${game === "bms" ? "ejectbrass" : "1"}" "tag_brass" 0 0 0 rotate 0 0 0
$cbox 0 0 0 0 0 0

${seqText}`
Deno.writeTextFileSync(`${out}/v_shotgun.qc`, qc)
Deno.writeTextFileSync(`${wOut}/w_shotgun.qc`, wq.replace(/(\$modelname[^\n]*\n)/, `$1${[...cd].map((d) => `$cdmaterials "${d.replaceAll("/", "\\")}"\n`).join("")}`))
console.log("sequences", seqs.length, "clips", used.join(" "), "materials", mats.size, "dropped", [...missing].join(" ") || "none")
