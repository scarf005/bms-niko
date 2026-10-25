// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: proportions.ts <model.smd> <anim_ref.smd> <outDir>; writes proportions.smd (model rest skeleton) and reference.smd
// (same skeleton, bones present in the anim ref take its local pose) for the proportion-trick delta sequence
const read = (f: string) => {
  const L = Deno.readTextFileSync(f).split(/\r?\n/), nodes: string[] = [], pose = new Map<string, string>(), names = new Map<number, string>()
  let i = L.findIndex((l) => l.trim() === "nodes") + 1
  for (; L[i].trim() !== "end"; i++) { nodes.push(L[i]); const m = L[i].trim().match(/^(\d+)\s+"([^"]*)"/)!; names.set(+m[1], m[2]) }
  i = L.findIndex((l) => /^time 0\b/.test(l.trim())) + 1
  for (; !/^(time|end)/.test(L[i].trim()); i++) { const t = L[i].trim().split(/\s+/); pose.set(names.get(+t[0])!, t.slice(1).join(" ")) }
  return { nodes, names, pose }
}
const [model, ref, out] = Deno.args, m = read(model), r = read(ref)
const smd = (pick: (n: string) => string) => ["version 1", "nodes", ...m.nodes, "end", "skeleton", "time 0", ...[...m.names].map(([id, n]) => `${id} ${pick(n)}`), "end", ""].join("\n")
Deno.writeTextFileSync(`${out}/proportions.smd`, smd((n) => m.pose.get(n)!))
Deno.writeTextFileSync(`${out}/reference.smd`, smd((n) => r.pose.get(n) ?? m.pose.get(n)!))
