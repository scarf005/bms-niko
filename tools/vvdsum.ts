// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: vvdsum.ts <vvd>; histogram of |sum-1| and count/bone patterns
const b = await Deno.readFile(Deno.args[0]), v = new DataView(b.buffer)
const n = v.getInt32(16, true), s = v.getInt32(56, true), h = new Map<string, number>()
for (let i = 0; i < n; i++) {
  const o = s + i * 48, w = [0, 1, 2].map((k) => v.getFloat32(o + 4 * k, true)), c = b[o + 15]
  const d = Math.abs(w.reduce((a, x) => a + x, 0) - 1), k = `c${c} d${d === 0 ? "0" : d < 1e-6 ? "<1e-6" : d < 1e-4 ? "<1e-4" : ">=1e-4"} extra${w.slice(c).some((x) => x !== 0)}`
  h.set(k, (h.get(k) ?? 0) + 1)
}
console.log([...h].sort())
