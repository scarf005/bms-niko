// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: weapons.ts <name...>; extract, decompile, patch, compile and install nike arms into each weapon viewmodel
// env: BMS, OUT, CROWBAR, WINEPREFIX, SDK
import { normalizeMdl } from "./normalizemdl.ts"
const T = new URL(".", import.meta.url).pathname, S = Deno.cwd(), B = Deno.env.get("BMS")!, INST = `${Deno.env.get("OUT")}/models/weapons`
const run = async (cmd: string, args: string[]) => await new Deno.Command(cmd, { args, stdout: "piped", stderr: "piped", env: { WINEDEBUG: "-all" } }).output()
const text = (r: Deno.CommandOutput) => new TextDecoder().decode(r.stdout) + new TextDecoder().decode(r.stderr)
await Deno.mkdir(INST, { recursive: true })
for (const w of Deno.args) {
  try {
    const d = `${S}/bmsp/w/${w}`
    if (!(await Deno.stat(`${d}/dec`).catch(() => null))) {
      await run("deno", ["run", "-A", `${T}vpkx.ts`, `${B}/bms_models_dir.vpk`, `^models/weapons/${w}\\.(mdl|vvd|dx90\\.vtx|ani|phy)$`, d])
      await run("timeout", ["300", "xvfb-run", "wine", Deno.env.get("CROWBAR")!, "-p", `Z:${d}/${w}.mdl`, "-o", `Z:${d}/dec`])
    }
    console.log(w, "mkweapon:", text(await run("deno", ["run", "-A", `${T}mkweapon.ts`, w])).trim().split("\n").slice(-2).join(" | "))
    await Deno.mkdir(`${d}/out`, { recursive: true })
    const c = await run("deno", ["run", "-A", `${T}compile.ts`, `${d}/build`, "patched.qc", `${d}/out`, "weapons"])
    // studiomdl names vtx files after the QC's $modelname case (v_HGun); install under the lowercase name
    const real = new Map([...Deno.readDirSync(`${d}/out`)].map((e) => [e.name.toLowerCase(), e.name])), files = [...real.keys()]
    console.log(w, "compiled:", files.join(" "))
    if (["mdl", "vvd", "dx90.vtx", "dx80.vtx", "sw.vtx"].every((e) => files.includes(`${w}.${e}`))) {
      for (const e of ["mdl", "vvd", "dx90.vtx", "dx80.vtx", "sw.vtx", "phy"]) if (files.includes(`${w}.${e}`)) {
        const b = await Deno.readFile(`${d}/out/${real.get(`${w}.${e}`)}`)
        await Deno.writeFile(`${INST}/${w}.${e}`, e === "mdl" ? normalizeMdl(b) : b)
      }
      console.log(w, "INSTALLED")
    } else console.log(w, "INCOMPLETE", text(c).slice(-200))
  } catch (e) { console.log(w, "ERROR", String(e).slice(0, 200)) }
}
console.log("ALLDONE")
