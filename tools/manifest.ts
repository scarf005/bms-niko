// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: manifest.ts <dir> > manifest.sha256; SHA-256 of every file under <dir> (model files in canonical form)
import { canonical } from "./normalizemdl.ts"
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("")
export const hashTree = async (root: string) => {
  const got = new Map<string, string>()
  const walk = async (d: string) => { for (const e of [...Deno.readDirSync(d)].sort((a, b) => a.name.localeCompare(b.name))) {
    const p = `${d}/${e.name}`
    if (e.isDirectory) await walk(p)
    else got.set(p.slice(root.length + 1), hex(await crypto.subtle.digest("SHA-256", canonical(e.name, await Deno.readFile(p)))))
  } }
  await walk(root)
  return got
}
if (import.meta.main) for (const [f, h] of await hashTree(Deno.args[0])) console.log(`${h}  ${f}`)
