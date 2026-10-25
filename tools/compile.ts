// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: compile.ts <qcDir> <qc> <outDir>; runs studiomdl under wine, captures outputs before its exit crash
const [dir, qc, out, sub = "PM"] = Deno.args, S = Deno.cwd(), SDK = "/media/scarf/@steam/SteamLibrary/steamapps/common/Source SDK Base 2013 Multiplayer/bin/studiomdl.exe"
const watch = new Deno.Command("inotifywait", { args: ["-m", "-q", "-e", "close_write", "--format", "%f", `${S}/cg/models/${sub}`], stdout: "piped" }).spawn()
// parallel runs share the output dir: copy only this QC's model files
const stem = (Deno.readTextFileSync(`${dir}/${qc}`).match(/\$modelname\s+"([^"]+)"/)?.[1] ?? "").split(/[\\/]/).pop()!.replace(/\.mdl$/i, "").toLowerCase() + "."
const copies: Promise<unknown>[] = []
;(async () => {
  for await (const line of watch.stdout.pipeThrough(new TextDecoderStream())) for (const f of line.split("\n").filter((f) => f.toLowerCase().startsWith(stem)))
    copies.push((async () => { await new Promise((r) => setTimeout(r, 1500)); await Deno.copyFile(`${S}/cg/models/${sub}/${f}`, `${out}/${f}`) })())
})()
await Deno.mkdir(out, { recursive: true })
const p = new Deno.Command("xvfb-run", { args: ["-a", "wine", SDK, "-nop4", "-game", `Z:${S}/cg`, `Z:${dir}/${qc}`], env: { WINEPREFIX: `${Deno.env.get("HOME")}/.local/share/wineprefixes/crowbar`, WINEDEBUG: "-all" }, stdout: "piped", stderr: "piped" }).output()
await Deno.writeFile(`${out}/studiomdl.log`, (await p).stdout)
await new Promise((r) => setTimeout(r, 6000)); await Promise.all(copies); watch.kill()
console.log("done", [...Deno.readDirSync(out)].map((e) => e.name).join(" "))
