// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
for (const f of Deno.args) { const L = Deno.readTextFileSync(f).split("\n"); const i = L.indexOf("triangles"); const mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9]
 for (let k=i+1;k<L.length;k++){ const t=L[k].trim().split(/\s+/); if (t.length<9||isNaN(+t[1])) continue; for(let a=0;a<3;a++){mn[a]=Math.min(mn[a],+t[1+a]);mx[a]=Math.max(mx[a],+t[1+a])} }
 console.log(f.split("/").pop(), mn.map(x=>x.toFixed(1)).join(" "), "..", mx.map(x=>x.toFixed(1)).join(" ")) }
