// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: weapons.ts <name...>; extract, decompile, patch, compile and install nike arms into each weapon viewmodel
const S = Deno.cwd(), B = "/media/scarf/@steam/SteamLibrary/steamapps/common/Black Mesa/bms", INST = `${B}/custom/niko/models/weapons`
const env = { WINEPREFIX: `${Deno.env.get("HOME")}/.local/share/wineprefixes/crowbar`, WINEDEBUG: "-all" }
const run = async (cmd: string, args: string[], opt: Deno.CommandOptions = {}) => (await new Deno.Command(cmd, { args, stdout: "piped", stderr: "piped", ...opt }).output())
await Deno.mkdir(INST, { recursive: true })
for (const w of Deno.args) {
  try {
    const d = `${S}/bmsp/w/${w}`
    if (!(await Deno.stat(`${d}/dec`).catch(() => null))) {
      await run("deno", ["run", "-A", "tools/vpkx.ts", `${B}/bms_models_dir.vpk`, `^models/weapons/${w}\\.(mdl|vvd|dx90\\.vtx|ani|phy)$`, d])
      const r = await run("timeout", ["300", "xvfb-run", "-a", "wine", `${Deno.env.get("HOME")}/.local/share/crowbar/cli/CrowbarCommandLineDecomp.exe`, "-p", `Z:${d}/${w}.mdl`, "-o", `Z:${d}/dec`], { env })
      void r
    }
    const m = await run("deno", ["run", "-A", "tools/mkweapon.ts", w]); const mo = new TextDecoder().decode(m.stdout) + new TextDecoder().decode(m.stderr)
    console.log(w, "mkweapon:", mo.trim().split("\n").slice(-2).join(" | "))
    // parallel runs share cg/models/weapons; clear only this weapon's stale outputs
    for (const e of Deno.readDirSync(`${S}/cg/models/weapons`)) if (e.name.toLowerCase().startsWith(`${w}.`)) await Deno.rename(`${S}/cg/models/weapons/${e.name}`, `${S}/removed/${e.name}`)
    await run("bash", ["-c", `mv ${d}/out ${S}/removed/${w}_out_$(date +%s) 2>/dev/null; true`])
    await Deno.mkdir(`${d}/out`, { recursive: true })
    const c = await run("deno", ["run", "-A", "tools/compile.ts", `${d}/build`, "patched.qc", `${d}/out`, "weapons"])
    // studiomdl names vtx files after the QC's $modelname case (v_HGun); install under the lowercase name
    const real = new Map([...Deno.readDirSync(`${d}/out`)].map((e) => [e.name.toLowerCase(), e.name])), files = [...real.keys()]
    console.log(w, "compiled:", files.join(" "))
    if (["mdl", "vvd", "dx90.vtx", "dx80.vtx", "sw.vtx"].every((e) => files.includes(`${w}.${e}`))) {
      for (const e of ["mdl", "vvd", "dx90.vtx", "dx80.vtx", "sw.vtx", "phy"]) if (files.includes(`${w}.${e}`)) await Deno.copyFile(`${d}/out/${real.get(`${w}.${e}`)}`, `${INST}/${w}.${e}`)
      console.log(w, "INSTALLED")
    } else console.log(w, "INCOMPLETE", new TextDecoder().decode(c.stderr).slice(-200))
  } catch (e) { console.log(w, "ERROR", String(e).slice(0, 200)) }
}
console.log("ALLDONE")
