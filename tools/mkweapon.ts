// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: mkweapon.ts <weapon> ; builds a patched QC dir bmsp/w/<weapon>/build with nike arms replacing the arms bodygroup
const T = new URL(".", import.meta.url).pathname, w = Deno.args[0], base = `bmsp/w/${w}/dec`, out = `bmsp/w/${w}/build`
await Deno.mkdir(out, { recursive: true })
const qcName = [...Deno.readDirSync(base)].find((e) => e.name.endsWith(".qc"))!.name
let q = Deno.readTextFileSync(`${base}/${qcName}`)
const rig = [...Deno.readDirSync(base)].map((e) => e.name).find((n) => /(hev_standardrig(_[lr])?|^v_hands_ref)\.smd$/.test(n))!
const r = new Deno.Command("deno", { args: ["run", "-A", `${T}retarget.ts`, "arms", `${base}/${rig}`, Deno.readTextFileSync(`${base}/${rig}`).includes("\"Bip001 ") ? "arms/map.json" : "arms/mapw.json", `${out}/nk`, "arms/na/dec/Arms.smd"] }).outputSync()
console.log(new TextDecoder().decode(r.stdout).trim())
await Deno.copyFile(`${out}/nk/Arms.smd`, `${out}/nike_arms_w.smd`)
const L = Deno.readTextFileSync(`${out}/nike_arms_w.smd`).split(/\r?\n/), t = L.indexOf("triangles"), keep = L.slice(0, t + 1); let i = t + 1
for (; L[i] !== "end" && i < L.length; i += 4) if (L[i].trim() !== "OH_Outline_Material") keep.push(...L.slice(i, i + 4))
keep.push("end"); Deno.writeTextFileSync(`${out}/nike_arms_w.smd`, keep.join("\n") + "\n")
// replace studio lines inside the arms bodygroup
q = q.replace(/(\$bodygroup "arms"\s*\{)([\s\S]*?)(\n\})/, (_m, a, body, c) => a + body.replace(/studio\s+"[^"]*"/g, 'studio "nike_arms_w.smd"') + c)
q = q.replace(/(\$texturegroup "skinfamilies"\s*\{\s*\{)([^}]*)(\})/, (_m, a, row) => {
  const names = [...row.matchAll(/"([^"]*)"/g)].map((m) => m[1]), handNames = new Set(["v_hand", "v_hand_m", "marine_d", "bare_hands_d", "gman_hands_d", "sec_guard_d", "zombie_hands_diffuse", "zombie_guard_hands_d"])
  return a + names.filter((n) => !handNames.has(n)).concat(["body1", "T_cloth_1"]).map((n) => `"${n}"`).join(" ") + " " + "}"
})
// the decompiler repeats some corrective $animation blocks; studiomdl rejects duplicate names, keep the first
const seen = new Set<string>()
q = q.replace(/^\$animation "([^"]+)"[^\n]*\{\r?\n[\s\S]*?^\}\r?\n/gm, (m, n) => seen.has(n) ? "" : (seen.add(n), m))
q = q.replace(/(\$cdmaterials[^\n]*\n)/, '$1$cdmaterials "atri\\ba\\nike\\"\n')
// link anims and other referenced files
// (anim directories get copies with the forearm twist bone animated)
for (const e of Deno.readDirSync(base)) {
  if (e.name === qcName || e.name.match(/standardrig(_[lr])?\.smd$/)) continue
  const src = Deno.realPathSync(`${base}/${e.name}`), dst = `${out}/${e.name}`
  if (!Deno.statSync(src).isDirectory) { try { Deno.symlinkSync(src, dst) } catch { /* exists */ } continue }
  await Deno.mkdir(dst, { recursive: true })
  for (const a of Deno.readDirSync(src)) if (a.name.endsWith(".smd")) new Deno.Command("deno", { args: ["run", "-A", `${T}twistbake.ts`, `${base}/${rig}`, `${src}/${a.name}`, `${dst}/${a.name}`] }).outputSync().success || console.log("twistbake failed", a.name)
}
Deno.writeTextFileSync(`${out}/patched.qc`, q)
