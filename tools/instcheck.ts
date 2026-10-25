// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: instcheck.ts <dir> <name...>; mdl header length vs file size, vvd/vtx presence and checksum match against the mdl
for (const n of Deno.args.slice(1)) {
  const p = `${Deno.args[0]}/${n}`, m = Deno.readFileSync(`${p}.mdl`), mv = new DataView(m.buffer), ck = mv.getInt32(8, true), bad: string[] = []
  if (mv.getInt32(76, true) !== m.length) bad.push("mdl length")
  try { const v = Deno.readFileSync(`${p}.vvd`); if (new DataView(v.buffer).getInt32(8, true) !== ck) bad.push("vvd checksum") } catch { bad.push("vvd missing") }
  for (const e of ["dx90.vtx", "dx80.vtx", "sw.vtx"]) try { const v = Deno.readFileSync(`${p}.${e}`); if (new DataView(v.buffer).getInt32(16, true) !== ck) bad.push(`${e} checksum`) } catch { bad.push(`${e} missing`) }
  const t = Deno.statSync(`${p}.mdl`).mtime!
  console.log(n.padEnd(18), bad.length ? "BAD " + bad.join(",") : "ok", t.toTimeString().slice(0, 8))
}
