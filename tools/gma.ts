// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
const [src, out] = Deno.args
const b = await Deno.readFile(src)
const v = new DataView(b.buffer)
let p = 4
const dec = new TextDecoder()
const cstr = () => { const s = p; while (b[p] !== 0) p++; return dec.decode(b.subarray(s, p++)) }
const ver = b[p++]
p += 16
if (ver > 1) while (cstr() !== "");
console.log("name:", cstr(), "| desc:", cstr().slice(0, 200), "| author:", cstr())
p += 4
const files: { name: string; size: number }[] = []
while (v.getUint32(p, true) !== 0) {
  p += 4
  const name = cstr()
  const size = Number(v.getBigInt64(p, true))
  p += 12
  files.push({ name, size })
}
p += 4
for (const f of files) {
  const dst = `${out}/${f.name}`
  await Deno.mkdir(dst.slice(0, dst.lastIndexOf("/")), { recursive: true })
  await Deno.writeFile(dst, b.subarray(p, p + f.size))
  p += f.size
}
console.log(files.length, "files")
