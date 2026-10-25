// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: render.ts <out.png> <eye x,y,z> <fwd x,y,z> <fovDeg> <smd>...; flat-shaded z-buffer render of SMD reference meshes (Source axes: z up)
type V = [number, number, number]
const [out, eyeS, fwdS, fovS, ...files] = Deno.args, W = 960, H = 540
const eye = eyeS.split(",").map(Number) as V, f0 = fwdS.split(",").map(Number) as V
const nrm = (v: V): V => { const l = Math.hypot(...v); return v.map((x) => x / l) as V }
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const fw = nrm(f0), rt = nrm(cross(fw, [0, 0, 1])), up = cross(rt, fw), foc = (W / 2) / Math.tan(+fovS * Math.PI / 360)
const zb = new Float32Array(W * H).fill(Infinity), img = new Uint8Array(W * H * 3).fill(40)
const cols: V[] = [[230, 230, 240], [240, 150, 150], [150, 200, 240], [180, 240, 150]]
files.forEach((f, fi) => {
  const L = Deno.readTextFileSync(f).split(/\r?\n/); let i = L.indexOf("triangles") + 1
  for (; i < L.length && L[i].trim() !== "end"; i += 4) {
    const P = [1, 2, 3].map((k) => L[i + k].trim().split(/\s+/).slice(1, 4).map(Number) as V)
    const n = nrm(cross(P[1].map((x, j) => x - P[0][j]) as V, P[2].map((x, j) => x - P[0][j]) as V)), sh = 0.35 + 0.65 * Math.abs(dot(n, fw))
    const S = P.map((p) => { const d = p.map((x, j) => x - eye[j]) as V, z = dot(d, fw); return [W / 2 + foc * dot(d, rt) / z, H / 2 - foc * dot(d, up) / z, z] })
    if (S.some((s) => s[2] < 0.5)) continue
    const [x0, x1] = [Math.max(0, Math.floor(Math.min(...S.map((s) => s[0])))), Math.min(W - 1, Math.ceil(Math.max(...S.map((s) => s[0]))))]
    const [y0, y1] = [Math.max(0, Math.floor(Math.min(...S.map((s) => s[1])))), Math.min(H - 1, Math.ceil(Math.max(...S.map((s) => s[1]))))]
    const ar = (S[1][0] - S[0][0]) * (S[2][1] - S[0][1]) - (S[2][0] - S[0][0]) * (S[1][1] - S[0][1]); if (Math.abs(ar) < 1e-9) continue
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const w0 = ((S[1][0] - x) * (S[2][1] - y) - (S[2][0] - x) * (S[1][1] - y)) / ar, w1 = ((S[2][0] - x) * (S[0][1] - y) - (S[0][0] - x) * (S[2][1] - y)) / ar, w2 = 1 - w0 - w1
      if (w0 < 0 || w1 < 0 || w2 < 0) continue
      const z = w0 * S[0][2] + w1 * S[1][2] + w2 * S[2][2], k = y * W + x; if (z >= zb[k]) continue
      zb[k] = z; const c = cols[fi % cols.length]; for (let j = 0; j < 3; j++) img[k * 3 + j] = c[j] * sh
    }
  }
})
const ppm = new Uint8Array([...new TextEncoder().encode(`P6 ${W} ${H} 255\n`), ...img])
const p = new Deno.Command("magick", { args: ["ppm:-", out], stdin: "piped" }).spawn(), w = p.stdin.getWriter(); await w.write(ppm); await w.close(); await p.status
