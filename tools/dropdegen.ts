// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: dropdegen.ts <dir>; removes zero-area (3D or UV) triangles from every non-physics .smd in dir
let total = 0
for (const e of Deno.readDirSync(Deno.args[0])) {
  if (!e.name.endsWith(".smd") || e.name.includes("physics")) continue
  const p = `${Deno.args[0]}/${e.name}`, L = Deno.readTextFileSync(p).split(/\r?\n/), t = L.indexOf("triangles"); if (t < 0) continue
  const out = L.slice(0, t + 1); let i = t + 1, dropped = 0
  for (; L[i] !== "end" && i < L.length; i += 4) {
    const v = [1, 2, 3].map((k) => L[i + k].trim().split(/\s+/).map(Number))
    const e1 = [0, 1, 2].map((k) => v[1][1 + k] - v[0][1 + k]), e2 = [0, 1, 2].map((k) => v[2][1 + k] - v[0][1 + k])
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]
    const a3 = Math.hypot(...cr), uv = (v[1][7] - v[0][7]) * (v[2][8] - v[0][8]) - (v[2][7] - v[0][7]) * (v[1][8] - v[0][8])
    if (a3 < 1e-6 || Math.abs(uv) < 1e-9) dropped++; else out.push(...L.slice(i, i + 4))
  }
  out.push(...L.slice(i)); Deno.writeTextFileSync(p, out.join("\n")); total += dropped; console.log(e.name, "dropped", dropped)
}
console.log("total", total)
