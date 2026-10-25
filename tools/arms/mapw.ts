// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
const m: Record<string,string> = {}
const fn = ["Thumb","Index","Middle","Ring","Pinky"]  // nike Finger0..4
for (const [s,p] of [["L","L"],["R","R"]]) {
  m[`ValveBiped.Bip01_${s}_Clavicle`] = `${p}_Arm`; m[`ValveBiped.Bip01_${s}_UpperArm`] = `${p}_Arm`
  m[`ValveBiped.Bip01_${s}_Forearm`] = `${p}_Forearm`; m[`ValveBiped.Bip01_${s}_Hand`] = `${p}_Wrist`
  for (let f = 0; f < 5; f++) for (const [k, j] of [["", 1], ["1", 2], ["2", 3]] as const) m[`ValveBiped.Bip01_${s}_Finger${f}${k}`] = `${p}_${fn[f]}${j}`
}
Deno.writeTextFileSync(Deno.args[0], JSON.stringify(m))
