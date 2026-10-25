// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
const b = await Deno.readFile(Deno.args[0]), v = new DataView(b.buffer), n = v.getInt32(156, true), o = v.getInt32(160, true)
const r: string[] = []
for (let i = 0; i < n; i++) { const p = o + i * 216; r.push(`${i}:${v.getInt32(p + 160, true).toString(16)}`) }
console.log(r.join(" "))
