// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: lens.ts <a.smd> <b.smd>: frame-0 local offset length of each ValveBiped bone in both
const sk = (f: string) => {
  const L = Deno.readTextFileSync(f).split(/\r?\n/), names = new Map<number, string>(), out = new Map<string, number[]>()
  let i = L.findIndex((l) => l.trim() === "nodes") + 1
  for (; L[i].trim() !== "end"; i++) { const m = L[i].trim().match(/^(\d+)\s+"([^"]*)"/)!; names.set(+m[1], m[2]) }
  i = L.findIndex((l) => /^time 0\b/.test(l.trim())) + 1
  for (; !/^(time|end)/.test(L[i].trim()); i++) { const n = L[i].trim().split(/\s+/).map(Number); out.set(names.get(n[0])!, n.slice(1, 4)) }
  return out
}
const a = sk(Deno.args[0]), b = sk(Deno.args[1])
for (const [n, p] of a) if (n.startsWith("ValveBiped") && b.has(n)) { const q = b.get(n)!; console.log(n.padEnd(36), Math.hypot(...p).toFixed(2), Math.hypot(...q).toFixed(2), (Math.hypot(...q) / Math.hypot(...p)).toFixed(2)) }
