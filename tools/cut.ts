// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: cut.ts <in.smd> <out.smd> <from> <to>; keeps triangles [from,to)
const [i, o, a, b] = Deno.args
const L = (await Deno.readTextFile(i)).split(/\r?\n/), t = L.indexOf("triangles")
const out = L.slice(0, t + 1)
for (let k = +a; k < +b; k++) out.push(...L.slice(t + 1 + 4 * k, t + 5 + 4 * k))
out.push("end", "")
await Deno.writeTextFile(o, out.join("\n"))
console.log("tris total", (L.lastIndexOf("end") - t - 1) / 4)
