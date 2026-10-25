// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: mdlbones.ts <mdl> [from to]; numbones and bone names/parents
const b = await Deno.readFile(Deno.args[0]), v = new DataView(b.buffer), n = v.getInt32(156, true), o = v.getInt32(160, true)
console.log("version", v.getInt32(4, true), "numbones", n)
const [from, to] = [+(Deno.args[1] ?? 0), +(Deno.args[2] ?? n - 1)]
for (let i = from; i <= to; i++) {
  const p = o + i * 216, no = v.getInt32(p, true), par = v.getInt32(p + 4, true)
  let e = p + no; const s: number[] = []; while (b[e]) s.push(b[e++])
  console.log(i, new TextDecoder().decode(new Uint8Array(s)), "parent", par)
}
