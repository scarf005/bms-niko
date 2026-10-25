// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: noalphatest.ts <vmt...> ; drops alpha-test lines from materials whose base alpha is a constant selfillum mask
const re = /^\s*"?\$(alphatest|alphatestreference|allowalphatocoverage)"?\s.*$\n?/gim;
for (const p of Deno.args) {
  const s = await Deno.readTextFile(p);
  const t = s.replace(re, "");
  if (t !== s) { await Deno.writeTextFile(p, t); console.log("fixed", p.split("/").pop()); }
}
