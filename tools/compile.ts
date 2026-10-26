// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: compile.ts <qcDir> <qc> <outDir>; runs studiomdl under wine, captures outputs before its exit crash
const [dir, qc, out, sub = "PM"] = Deno.args, S = Deno.cwd(), SDK = `${Deno.env.get("SDK")}/bin/studiomdl.exe`
const watch = new Deno.Command("inotifywait", { args: ["-m", "-q", "-e", "close_write", "--format", "%f", `${S}/cg/models/${sub}`], stdout: "piped" }).spawn()
// parallel runs share the output dir: copy only this QC's model files
const stem = (Deno.readTextFileSync(`${dir}/${qc}`).match(/\$modelname\s+"([^"]+)"/)?.[1] ?? "").split(/[\\/]/).pop()!.replace(/\.mdl$/i, "").toLowerCase() + "."
const CAPTURE = Deno.env.get("CAPTURE") ?? "first", seen = new Set<string>()
;(async () => {
  for await (const line of watch.stdout.pipeThrough(new TextDecoderStream())) for (const f of line.split("\n").filter((f) => f.toLowerCase().startsWith(stem))) {
    // studiomdl writes each file, then rewrites all of them in a final pass and deletes them when it crashes at exit.
    // CAPTURE=first keeps the files as first written (what the installed mod was built from), CAPTURE=last the final pass
    if (CAPTURE === "first" && seen.has(f)) continue
    seen.add(f)
    try { await Deno.copyFile(`${S}/cg/models/${sub}/${f}`, `${out}/${f}`) } catch { /* deleted already */ }
  }
})()
await Deno.mkdir(out, { recursive: true })
const p = new Deno.Command("xvfb-run", { args: ["-a", "wine", SDK, "-nop4", "-game", `Z:${S}/cg`, `Z:${dir}/${qc}`], env: { WINEPREFIX: Deno.env.get("WINEPREFIX")!, WINEDEBUG: "-all" }, stdout: "piped", stderr: "piped" }).output()
await Deno.writeFile(`${out}/studiomdl.log`, (await p).stdout)
await new Promise((r) => setTimeout(r, 6000)); watch.kill()
console.log("done", [...Deno.readDirSync(out)].map((e) => e.name).join(" "))
