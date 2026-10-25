// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
const m: Record<string,string> = {}
for (const s of ["L","R"]) {
  for (const [a,b] of [["Clavicle","Clavicle"],["UpperArm","UpperArm"],["Forearm","Forearm"],["Hand","Hand"]]) m[`ValveBiped.Bip01_${s}_${a}`] = `Bip001 ${s} ${b}`
  for (const f of [0,1,2,3,4]) for (const k of ["","1","2"]) m[`ValveBiped.Bip01_${s}_Finger${f}${k}`] = `Bip001 ${s} Finger${f}${k}`
}
Deno.writeTextFileSync(Deno.args[0], JSON.stringify(m))
