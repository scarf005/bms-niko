// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: mkplayerqc.ts <decompiled nike_pm.qc> <decompiled BMS mp_scientist_hev.qc> <out player.qc>
// turns the decompiled addon QC into the Black Mesa player QC: BMS animations via $includemodel, the proportion trick,
// no flexes, BMS attachments, hitboxes and ik chains, and the addon's own collision joints
const [src, bmsQc, dst] = Deno.args
const read = (f: string) => Deno.readTextFileSync(f).replaceAll("\r\n", "\n")
const q = read(src), bms = read(bmsQc)
const cut = (from: string, to: string) => { const a = q.indexOf(from), b = q.indexOf(to, a); if (a < 0 || b < 0) throw new Error(`QC section ${from} missing`); return q.slice(a, b) }
const hboxes = [...bms.matchAll(/^\$hbox .*$/gm)].map((m) => m[0]).join("\n")
const joints = q.slice(q.indexOf("$collisionjoints"), q.indexOf("\n}\n", q.indexOf("$collisionjoints")) + 3)
const att = `$attachment "eyes" "ValveBiped.Bip01_Head1" 3.76 -4.42 -0.04 rotate 0 -80.1 -90
$attachment "mouth" "ValveBiped.Bip01_Head1" 1 -6.3 0 rotate 0 -80 -90
$attachment "anim_attachment_RH" "ValveBiped.Bip01_R_Hand" 0.13727 -1.167179 0.17484 rotate -61.313932 -14.862647 39.878087
$attachment "anim_attachment_LH" "ValveBiped.Bip01_L_Hand" 2.67609 -1.71244 0 rotate 0.000002 90.000207 90.000207
$attachment "anim_attachment_head" "ValveBiped.Bip01_Head1" 0 0 0 rotate -90 -90 0
$attachment "forward" "ValveBiped.Bip01_Head1" 1.999992 -3.000001 0 rotate 0 -75.999986 -90.000207
$attachment "neck" "ValveBiped.Bip01_Neck1" 3 -4 0 rotate 0 -90 -90
`
// the included BMS animations carry BMS bone positions; an autoplay delta adds back this model's own bone lengths
const out = `// Created by Crowbar 0.68

$modelname "PM/nike_player.mdl"

$includemodel "player/BMDM_male_anims.mdl"

$sequence "reference" "reference.smd" fps 1
$animation "a_proportions" "proportions.smd" subtract "reference" 0
$sequence "proportions" "a_proportions" predelta autoplay

$bodygroup "HEAD"
{
	studio "face.smd"
}
${cut('$bodygroup "body"', "$attachment")}
${att}
${cut("$cbox", "$hboxset")}$hboxset "default"
${hboxes}
$skipboneinbbox


${joints}
$bonemerge "ValveBiped.Bip01_R_Hand"
$ikchain "rhand" "ValveBiped.Bip01_R_Hand" knee 0.707 0.707 0
$ikchain "lhand" "ValveBiped.Bip01_L_Hand" knee 0.707 0.707 0
$ikchain "rfoot" "ValveBiped.Bip01_R_Foot" knee 0.707 -0.707 0
$ikchain "lfoot" "ValveBiped.Bip01_L_Foot" knee 0.707 -0.707 0
`
Deno.writeTextFileSync(dst, out)
