// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: build.ts <stage...>; stages run in order: gma static materials pm-red bms pm install weapons verify (default: all)
// env: BMS (Black Mesa bms dir), GMA (workshop item .gma), SDK (Source SDK Base 2013 Multiplayer dir),
//      CROWBAR (CrowbarCommandLineDecomp.exe), WINEPREFIX, WORK (scratch dir), OUT (result dir)
import { hashTree } from "./manifest.ts"
import { normalizeMdl } from "./normalizemdl.ts"
const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "")
const HOME = Deno.env.get("HOME")!
const env = (k: string, d: string) => Deno.env.get(k) ?? d
const STEAM = env("STEAM", `${HOME}/.local/share/Steam`)
export const cfg = {
  bms: env("BMS", `${STEAM}/steamapps/common/Black Mesa/bms`),
  gma: env("GMA", `${STEAM}/steamapps/workshop/content/4000/3263112279/3263112279_via_crowbar.gma`),
  sdk: env("SDK", `${STEAM}/steamapps/common/Source SDK Base 2013 Multiplayer`),
  crowbar: env("CROWBAR", `${HOME}/.local/share/crowbar/cli/CrowbarCommandLineDecomp.exe`),
  prefix: env("WINEPREFIX", `${HOME}/.local/share/wineprefixes/crowbar`),
  work: env("WORK", `${REPO}/work`),
  out: env("OUT", `${REPO}/work/out`),
}
// child tools read these
for (const [k, v] of Object.entries({ SDK: cfg.sdk, WINEPREFIX: cfg.prefix, BMS: cfg.bms, CROWBAR: cfg.crowbar, OUT: cfg.out })) Deno.env.set(k, v)
const sh = async (cmd: string, args: string[], opt: Deno.CommandOptions = {}) => {
  const r = await new Deno.Command(cmd, { args, stdout: "piped", stderr: "piped", ...opt }).output()
  if (!r.success && !opt.signal) throw new Error(`${cmd} ${args.join(" ")}\n${new TextDecoder().decode(r.stderr).slice(-600)}`)
  return new TextDecoder().decode(r.stdout)
}
const deno = (script: string, args: string[]) => sh("deno", ["run", "-A", `${REPO}/tools/${script}`, ...args], { cwd: cfg.work })
const wineEnv = { WINEPREFIX: cfg.prefix, WINEDEBUG: "-all" }
// Crowbar decompiles <dir>/<name>.mdl (with vvd/vtx/phy beside it) into <dir>/dec
export const decompile = async (mdl: string, out: string) => {
  await Deno.mkdir(out, { recursive: true })
  await sh("timeout", ["400", "xvfb-run", "-a", "wine", cfg.crowbar, "-p", `Z:${mdl}`, "-o", `Z:${out}`], { env: wineEnv })
}
const copyTree = async (src: string, dst: string) => { await Deno.mkdir(dst, { recursive: true }); await sh("cp", ["-a", `${src}/.`, dst]) }
const W = (p: string) => `${cfg.work}/${p}`

const stages: Record<string, () => Promise<void>> = {
  async gma() {
    await Deno.mkdir(W("gma"), { recursive: true })
    await deno("gma.ts", [cfg.gma, W("gma")])
  },
  // files shipped unchanged from the addon
  async static() {
    for (const p of ["materials/vgui", "models/arms", "models/npc"]) await copyTree(W(`gma/${p}`), `${cfg.out}/${p}`)
  },
  // the addon's alpha test makes the textures see-through in Black Mesa: drop it, and replace the outline shell with a blank material
  async materials() {
    const src = W("gma/materials/atri/ba/nike"), dst = `${cfg.out}/materials/atri/ba/nike`
    await copyTree(src, dst)
    const vmts = [...Deno.readDirSync(dst)].filter((e) => e.name.endsWith(".vmt") && !e.name.includes("outline")).map((e) => `${dst}/${e.name}`)
    await deno("noalphatest.ts", vmts)
    await Deno.writeTextFile(`${dst}/oh_outline_material.vmt`, ['"VertexlitGeneric"', "{", '\t$basetexture "atri/ba/nike/white_trans"', "\t$alphatest\t1", "\t$nodecal 1", "", "}"].join("\r\n"))
  },
  // addon pm: decompile, keep the 128 heaviest bones, drop the outline shell
  async "pm-red"() {
    const d = W("dec")
    await Deno.mkdir(d, { recursive: true })
    for (const e of ["mdl", "vvd", "dx90.vtx", "phy"]) await Deno.copyFile(W(`gma/models/pm/nike_pm.${e}`), `${d}/nike_pm.${e}`)
    await decompile(`${d}/nike_pm.mdl`, `${d}/out`)
    await deno("reduce.ts", ["dec/out", "dec/red", "ValveBiped.Bip01_", "128"])
    await deno("strip_outline.ts", ["dec/red", "OH_Outline_Material"])
  },
  // Black Mesa side: player skeleton and shared animations
  async bms() {
    const d = W("bmsp")
    await deno("vpkx.ts", [`${cfg.bms}/bms_models_dir.vpk`, "^models/player/([Bb][Mm][Dd][Mm]_[Mm]ale_[Aa]nims\\.mdl|mp_scientist_hev\\.(mdl|vvd|dx90\\.vtx|phy))$", d])
    await decompile(`${d}/mp_scientist_hev.mdl`, `${d}/dec`)
    // studiomdl reads $includemodel from the game dir
    await Deno.mkdir(W("cg/models/player"), { recursive: true })
    await Deno.mkdir(W("cg/models/PM"), { recursive: true })
    await Deno.copyFile(`${d}/bmdm_male_anims.mdl`, W("cg/models/player/BMDM_male_anims.mdl"))
    await copyTree(W("gma/materials"), W("cg/materials"))
    await Deno.writeTextFile(W("cg/gameinfo.txt"), `"GameInfo"\n{\n\tgame "cg"\n\tFileSystem\n\t{\n\t\tSteamAppId 243750\n\t\tSearchPaths\n\t\t{\n\t\t\tgame+mod\t|gameinfo_path|.\n\t\t}\n\t}\n}\n`)
  },
  // player model: addon meshes posed on the Black Mesa skeleton, compiled once and installed under every player model path
  async pm() {
    const smd = ["body", "face", "hair", "ear", "halo", "T_cloth_0", "T_cloth_1", "T_cloth_1_2", "T_cloth_1_3", "shoes", "nike_pm_physics"].map((n) => `dec/red/${n}.smd`)
    await Deno.mkdir(W("dec/pm"), { recursive: true })
    await deno("retarget.ts", ["pose", "bmsp/dec/base_male_combat_nohands.smd", "-", "dec/pm", ...smd])
    await deno("dropdegen.ts", ["dec/pm"])
    await deno("proportions.ts", ["dec/pm/body.smd", "bmsp/dec/base_male_combat_nohands.smd", "dec/pm"])
    await deno("mkplayerqc.ts", ["dec/out/nike_pm.qc", "bmsp/dec/mp_scientist_hev.qc", "dec/pm/player.qc"])
    await deno("compile.ts", [W("dec/pm"), "player.qc", W("out10"), "PM"])
  },
  async install() {
    const exts = ["mdl", "vvd", "phy", "dx90.vtx", "dx80.vtx", "sw.vtx"]
    const names = ["pm/nike_pm", "player/mp_scientist_hev", "Player/mp_scientist_hev", "player", "humans/hev_gordon", "humans/hev_male", "humans/hev_male_xen"]
    for (const n of names) for (const e of exts) {
      const dst = `${cfg.out}/models/${n}.${e}`
      await Deno.mkdir(dst.slice(0, dst.lastIndexOf("/")), { recursive: true })
      const b = await Deno.readFile(W(`out10/nike_player.${e}`))
      await Deno.writeFile(dst, e === "mdl" ? normalizeMdl(b) : b)
    }
  },
  // viewmodels: the addon's arms replace the arms bodygroup of every Black Mesa weapon, compiled one after another
  async weapons() {
    const na = W("arms/na")
    await Deno.mkdir(na, { recursive: true })
    for (const e of ["mdl", "vvd", "dx90.vtx"]) await Deno.copyFile(W(`gma/models/arms/nike_arms.${e}`), `${na}/nike_arms.${e}`)
    await decompile(`${na}/nike_arms.mdl`, `${na}/dec`)
    await deno("arms/map.ts", ["arms/map.json"])
    await deno("arms/mapw.ts", ["arms/mapw.json"])
    const ws = ["v_357", "v_crossbow", "v_crowbar", "v_egon", "v_gauss", "v_glock", "v_grenade", "v_hands", "v_headcrabbed", "v_hgun", "v_mp5", "v_pipewrench", "v_rpg", "v_satchel", "v_satchel_radio", "v_shotgun", "v_squeak", "v_stunstick", "v_syringe", "v_tripmine", "v_zombiemelee"]
    await Deno.mkdir(W("cg/models/weapons"), { recursive: true })
    const bad = (await deno("weapons.ts", ws)).split("\n").filter((l) => /INCOMPLETE|ERROR/.test(l))
    if (bad.length) throw new Error(`weapons failed:\n${bad.join("\n")}`)
  },
  // every output file against manifest.sha256 (mdl, vvd and vtx are hashed in canonical form; a mismatch there is only a warning, as studiomdl is not fully deterministic)
  async verify() {
    const want = new Map(Deno.readTextFileSync(`${REPO}/manifest.sha256`).trim().split("\n").map((l) => [l.slice(66), l.slice(0, 64)]))
    const got = await hashTree(cfg.out)
    const model = (f: string) => /\.(mdl|vvd|vtx)$/.test(f)
    const diff = [...want].filter(([f, h]) => got.get(f) !== h).map(([f]) => f).concat([...got.keys()].filter((f) => !want.has(f)))
    const bad = diff.filter((f) => !model(f))
    for (const f of diff.filter(model)) console.warn(`warning: ${f} differs from manifest.sha256 (studiomdl output varies between runs)`)
    if (bad.length) throw new Error(`${bad.length} files differ from manifest.sha256:\n${bad.join("\n")}`)
    console.log(`${got.size - diff.length} of ${got.size} files match manifest.sha256`)
  },
}

const want = Deno.args.length ? Deno.args : Object.keys(stages)
await Deno.mkdir(cfg.work, { recursive: true })
for (const s of want) { console.log(`== ${s}`); await (stages[s] ?? (() => { throw new Error(`unknown stage ${s}`) }))() }
