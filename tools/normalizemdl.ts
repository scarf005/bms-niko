// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: normalizemdl.ts <file.mdl...>; studiomdl under wine leaves uninitialized heap pointers in runtime-only fields
// (material/clientmaterial of each mstudiotexture_t, vertexdata of each mstudiomodel_t and mstudiomesh_t); the engine overwrites them on load, so zero them in place
export const normalizeMdl = (b: Uint8Array<ArrayBuffer>) => {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength), i32 = (o: number) => v.getInt32(o, true)
  const num = i32(204), at = i32(208)
  for (let i = 0; i < num; i++) { v.setUint32(at + i * 64 + 16, 0, true); v.setUint32(at + i * 64 + 20, 0, true) }
  for (let p = 0; p < i32(232); p++) {
    const bp = i32(236) + p * 16
    for (let m = 0; m < i32(bp + 4); m++) { const mo = bp + i32(bp + 12) + m * 148; v.setBigUint64(mo + 108, 0n, true)
      for (let k = 0; k < i32(mo + 72); k++) for (let o = 48; o < 84; o += 4) v.setUint32(mo + i32(mo + 76) + k * 116 + o, 0, true)
    }
  }
  return b
}
if (import.meta.main) for (const f of Deno.args) Deno.writeFileSync(f, normalizeMdl(Deno.readFileSync(f)))
// hash form of a model file: runtime pointers zeroed, and the compile checksum (differs between runs of studiomdl) masked
export const canonical = (name: string, b: Uint8Array<ArrayBuffer>) => {
  const c = name.endsWith(".mdl") ? normalizeMdl(b.slice()) : b.slice(), o = name.endsWith(".vtx") ? 16 : name.endsWith(".mdl") || name.endsWith(".vvd") ? 8 : -1
  if (o >= 0) c.fill(0, o, o + 4)
  return c
}
