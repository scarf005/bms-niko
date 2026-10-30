// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// drops the outline shell and the arm skin under the sleeve (body1 with no hand or finger bone) from an arms SMD;
// that skin pokes through the sleeve where a rig bends the elbow, and it is never seen
export const filterArms = (smd: string) => {
  const L = smd.split(/\r?\n/), t = L.indexOf("triangles"), keep = L.slice(0, t + 1)
  const hand = new Set(L.slice(L.indexOf("nodes") + 1, L.indexOf("end")).flatMap((l) => { const m = l.match(/^\s*(\d+)\s+"([^"]*)"/); return m && /([ _]Hand|_Wrist|Finger\d*|Thumb\d|Index\d|Middle\d|Ring\d|Pinky\d)$/i.test(m[2]) ? [+m[1]] : [] }))
  const onHand = (v: string) => { const s = v.trim().split(/\s+/).map(Number); return s.slice(10, 10 + 2 * (s[9] ?? 0)).some((b, j) => j % 2 === 0 && hand.has(b)) }
  for (let i = t + 1; L[i] !== "end" && i < L.length; i += 4) if (L[i].trim() !== "OH_Outline_Material" && (L[i].trim() !== "body1" || L.slice(i + 1, i + 4).some(onHand))) keep.push(...L.slice(i, i + 4))
  keep.push("end")
  return keep.join("\n") + "\n"
}
