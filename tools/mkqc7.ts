// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
let q = Deno.readTextFileSync("dec/red6/player.qc")
const bms = Deno.readTextFileSync("bmsp/dec/mp_scientist_hev.qc")
const hb = [...bms.matchAll(/^\$hbox .*$/gm)].map((m) => m[0])
q = q.replace(/\$attachment .*\n/g, "").replace(/\$hbox .*\n/g, "").replace("$hboxset \"default\"\n", "$hboxset \"default\"\n" + hb.join("\n") + "\n")
const att = `$attachment "eyes" "ValveBiped.Bip01_Head1" 3.76 -4.42 -0.04 rotate 0 -80.1 -90
$attachment "mouth" "ValveBiped.Bip01_Head1" 1 -6.3 0 rotate 0 -80 -90
$attachment "anim_attachment_RH" "ValveBiped.Bip01_R_Hand" 0.13727 -1.167179 0.17484 rotate -61.313932 -14.862647 39.878087
$attachment "anim_attachment_LH" "ValveBiped.Bip01_L_Hand" 2.67609 -1.71244 0 rotate 0.000002 90.000207 90.000207
$attachment "anim_attachment_head" "ValveBiped.Bip01_Head1" 0 0 0 rotate -90 -90 0
$attachment "forward" "ValveBiped.Bip01_Head1" 1.999992 -3.000001 0 rotate 0 -75.999986 -90.000207
$attachment "neck" "ValveBiped.Bip01_Neck1" 3 -4 0 rotate 0 -90 -90
`
q = q.replace("$cbox", att + "\n$cbox")
Deno.writeTextFileSync("dec/red7/player.qc", q)
// proportion trick: the included BMS anims carry BMS bone positions; an autoplay delta adds back the model's own bone lengths
const prop = `$sequence "reference" "reference.smd" fps 1
$animation "a_proportions" "proportions.smd" subtract "reference" 0
$sequence "proportions" "a_proportions" predelta autoplay
`
Deno.writeTextFileSync("dec/red7/player.qc", Deno.readTextFileSync("dec/red7/player.qc").replace(/^\$bodygroup/m, prop + "\n$bodygroup"))
