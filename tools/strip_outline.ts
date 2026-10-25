// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: strip_outline.ts <dir> <material>; removes triangles using <material> from every non-physics .smd under dir
const [dir, mat] = Deno.args
let removed = 0
for await (const e of Deno.readDir(dir)) {
  if (!e.name.endsWith(".smd") || e.name.includes("physics")) continue
  const p = `${dir}/${e.name}`, L = (await Deno.readTextFile(p)).split(/\r?\n/), t = L.indexOf("triangles")
  if (t < 0) continue
  const out = L.slice(0, t + 1)
  let i = t + 1
  for (; L[i] !== "end" && i < L.length; i += 4) L[i].trim() === mat ? removed++ : out.push(...L.slice(i, i + 4))
  out.push(...L.slice(i))
  await Deno.writeTextFile(p, out.join("\n"))
}
console.log("removed", removed)
