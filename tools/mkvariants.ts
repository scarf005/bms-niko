// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// builds shoes variants in v/: va original, vb rigid single-bone, vc renamed material
const D = "dec/red4", src = (await Deno.readTextFile(`${D}/shoes.smd`)).split("\n"), t = src.indexOf("triangles")
const rigid = src.map((l, i) => { const p = l.trim().split(/\s+/); return i > t && p.length >= 10 && /^\d+$/.test(p[0]) && p.length > 11 ? `  ${p[0]} ${p.slice(1, 9).join(" ")} 1 ${p[10]} 1.000000` : l })
const mat = src.map((l, i) => i > t && l.trim() === "T_cloth_1" ? "shoesmat" : l)
await Deno.writeTextFile("v/shoes_b.smd", rigid.join("\n")); await Deno.writeTextFile("v/shoes_c.smd", mat.join("\n"))
await Deno.copyFile(`${D}/shoes.smd`, "v/shoes_a.smd"); await Deno.copyFile(`${D}/body.smd`, "v/body.smd")
for (const k of "abc") await Deno.writeTextFile(`v/v${k}.qc`, `$modelname "PM/v${k}.mdl"\n$sequence "idle" { "body.smd" fps 30 loop }\n$model "s" "shoes_${k}.smd"\n$surfaceprop "flesh"\n`)
