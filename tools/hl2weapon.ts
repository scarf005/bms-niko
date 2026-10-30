// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: hl2weapon.ts <weapon>; builds a patched QC dir hl2/w/<weapon>/build from hl2/w/<weapon>/dec: the HL2 hands (v_hand_sheet)
// leave the reference mesh and the nike arms take their place, bonemerged onto the viewmodel's ValveBiped arm bones
import { filterArms } from "./armsfilter.ts"
const T = new URL(".", import.meta.url).pathname, w = Deno.args[0], base = `hl2/w/${w}/dec`, out = `hl2/w/${w}/build`
await Deno.mkdir(out, { recursive: true })
const qcName = [...Deno.readDirSync(base)].find((e) => e.name.endsWith(".qc"))!.name
let q = Deno.readTextFileSync(`${base}/${qcName}`).replaceAll("\r\n", "\n")
const ref = q.match(/\$bodygroup "studio"\s*\{\s*studio "([^"]+)"/)![1]
const L = Deno.readTextFileSync(`${base}/${ref}`).split(/\r?\n/), t = L.indexOf("triangles"), keep = L.slice(0, t + 1)
for (let i = t + 1; i < L.length && L[i].trim() !== "end"; i += 4) if (L[i].trim().toLowerCase() !== "v_hand_sheet") keep.push(...L.slice(i, i + 4))
Deno.writeTextFileSync(`${out}/${ref}`, keep.concat("end", "").join("\n"))
const r = new Deno.Command("deno", { args: ["run", "-A", `${T}retarget.ts`, "merge", `${base}/${ref}`, "-", `${out}/nk`, "arms/na/dec/Arms.smd"] }).outputSync()
if (!r.success) throw new Error(new TextDecoder().decode(r.stderr))
console.log(new TextDecoder().decode(r.stdout).trim())
Deno.writeTextFileSync(`${out}/nike_arms_w.smd`, filterArms(Deno.readTextFileSync(`${out}/nk/Arms.smd`)))
// hands that are part of the gun mesh (no arm bones on that side) get the pistol build's arm fitted onto them
const f = new Deno.Command("deno", { args: ["run", "-A", `${T}hl2rigid.ts`, w, "v_pistol"] }).outputSync()
if (!f.success) throw new Error(new TextDecoder().decode(f.stderr))
console.log(new TextDecoder().decode(f.stdout).trim())
q = q.replace(/(\$bodygroup "studio"\s*\{[^}]*\}\n)/, '$1$body "arms" "nike_arms_w.smd"\n')
  .replace(/\$texturegroup "skinfamilies"\s*\{[\s\S]*?\n\}\n/, "")
  .replace(/(\$cdmaterials[^\n]*\n)/, '$1$cdmaterials "atri\\ba\\nike\\"\n')
for (const e of Deno.readDirSync(base)) if (e.name !== qcName && e.name !== ref) try { Deno.symlinkSync(Deno.realPathSync(`${base}/${e.name}`), `${out}/${e.name}`) } catch { /* exists */ }
Deno.writeTextFileSync(`${out}/patched.qc`, q)
