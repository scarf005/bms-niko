// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: compile.ts <qcDir> <qc> <outDir>; runs studiomdl under wine, captures outputs before its exit crash
const [dir, qc, out, sub = "PM"] = Deno.args, S = Deno.cwd(), SDK = `${Deno.env.get("SDK")}/bin/studiomdl.exe`
let T0 = Date.now()
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
const env = { WINEPREFIX: Deno.env.get("WINEPREFIX")!, WINEDEBUG: "-all" }
// studiomdl sometimes spins at full CPU before writing anything; the same QC compiles on the next run
let hung = false
for (let attempt = 1; ; attempt++) {
  const p = new Deno.Command("xvfb-run", { args: ["-a", "wine", SDK, "-nop4", "-game", `Z:${S}/cg`, `Z:${dir}/${qc}`], env, stdout: "piped", stderr: "null" }).spawn()
  hung = false
  const timer = setTimeout(() => { hung = true; new Deno.Command("wineserver", { args: ["-k"], env }).outputSync() }, 900_000)
  const log: Uint8Array<ArrayBuffer>[] = [], reader = p.stdout.getReader()
  const drain = (async () => { for (let r = await reader.read(); !r.done; r = await reader.read()) log.push(r.value) })()
  await p.status
  clearTimeout(timer)
  // wine services started by this run inherit the pipe and keep it open: stop reading shortly after studiomdl exits
  await Promise.race([drain, new Promise((r) => setTimeout(r, 2000))])
  await reader.cancel()
  await Deno.writeFile(`${out}/studiomdl.log`, new Uint8Array(await new Blob(log).arrayBuffer()))
  if (!hung || attempt === 2) break
  console.error("studiomdl hung, retrying")
  // count only what the rerun writes
  seen.clear()
  T0 = Date.now()
}
if (hung) { watch.kill(); console.error("studiomdl hung twice"); Deno.exit(1) }
await new Promise((r) => setTimeout(r, 6000)); watch.kill()
const fresh = [...Deno.readDirSync(out)].filter((e) => Deno.statSync(`${out}/${e.name}`).mtime!.getTime() >= T0 - 1000).map((e) => e.name)
if (!fresh.some((n) => n.endsWith(".mdl"))) { console.error("studiomdl produced no new mdl"); Deno.exit(1) }
console.log("done", fresh.join(" "))
