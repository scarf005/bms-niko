// SPDX-FileCopyrightText: 2026 scarf
// SPDX-License-Identifier: AGPL-3.0-only
// usage: build.ts <target or stage...> (default: niko); a target runs its stages in order:
//   niko: the Black Mesa Niko mod into OUT
//   niko-hl2: the Half-Life 2 Niko mod into OUT_HL2 (after niko)
//   m680: the Model 680 mod for Black Mesa and Half-Life 2 into OUT_M680/{bms,hl2} (after niko)
// env: BMS (Black Mesa bms dir), HL2 (Half-Life 2 dir), GMA (workshop item .gma), MW_GMA and MW_SG_GMA (MW Base and its
//      shotgun pack .gma), SDK (Source SDK Base 2013 Multiplayer dir), CROWBAR (CrowbarCommandLineDecomp.exe), WINEPREFIX,
//      WORK (scratch dir), OUT, OUT_HL2, OUT_M680 (result dirs)
import { hashTree } from "./manifest.ts"
import { normalizeMdl } from "./normalizemdl.ts"
const REPO = new URL("..", import.meta.url).pathname.replace(/\/$/, "")
const HOME = Deno.env.get("HOME")!
const env = (k: string, d: string) => Deno.env.get(k) ?? d
const STEAM = env("STEAM", `${HOME}/.local/share/Steam`)
export const cfg = {
  bms: env("BMS", `${STEAM}/steamapps/common/Black Mesa/bms`),
  hl2: env("HL2", `${STEAM}/steamapps/common/Half-Life 2`),
  gma: env("GMA", `${STEAM}/steamapps/workshop/content/4000/3263112279/3263112279_via_crowbar.gma`),
  mwGma: env("MW_GMA", `${STEAM}/steamapps/workshop/content/4000/2459720887/gmpublisher.gma`),
  mwSgGma: env("MW_SG_GMA", `${STEAM}/steamapps/workshop/content/4000/2751323984/gmpublisher.gma`),
  sdk: env("SDK", `${STEAM}/steamapps/common/Source SDK Base 2013 Multiplayer`),
  crowbar: env("CROWBAR", `${HOME}/.local/share/crowbar/cli/CrowbarCommandLineDecomp.exe`),
  prefix: env("WINEPREFIX", `${HOME}/.local/share/wineprefixes/crowbar`),
  work: env("WORK", `${REPO}/work`),
  out: env("OUT", `${REPO}/work/out`),
  outHl2: env("OUT_HL2", `${REPO}/work/out-hl2`),
  outM680: env("OUT_M680", `${REPO}/work/out-m680`),
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
  // no pipes: wine services started by this call inherit them and keep them open after Crowbar exits
  const r = await new Deno.Command("timeout", { args: ["400", "xvfb-run", "-a", "wine", cfg.crowbar, "-p", `Z:${mdl}`, "-o", `Z:${out}`], env: wineEnv, stdout: "null", stderr: "null" }).output()
  if (!r.success) throw new Error(`Crowbar failed on ${mdl}`)
}
const copyTree = async (src: string, dst: string) => { await Deno.mkdir(dst, { recursive: true }); await sh("cp", ["-a", `${src}/.`, dst]) }
const W = (p: string) => `${cfg.work}/${p}`
// studiomdl's game dir: $includemodel targets and the compiled models land under cg/models
const cg = async (...dirs: string[]) => {
  for (const d of ["", ...dirs]) await Deno.mkdir(W(`cg/models/${d}`), { recursive: true })
  await Deno.writeTextFile(W("cg/gameinfo.txt"), `"GameInfo"\n{\n\tgame "cg"\n\tFileSystem\n\t{\n\t\tSteamAppId 243750\n\t\tSearchPaths\n\t\t{\n\t\t\tgame+mod\t|gameinfo_path|.\n\t\t}\n\t}\n}\n`)
}
const exts = ["mdl", "vvd", "phy", "dx90.vtx", "dx80.vtx", "sw.vtx"]
// copies a compiled model's files to <dst>.<ext>; only the .phy may be missing
const installModel = async (src: string, dst: string) => {
  await Deno.mkdir(dst.slice(0, dst.lastIndexOf("/")), { recursive: true })
  for (const e of exts) {
    const b = await Deno.readFile(`${src}.${e}`).catch(() => null)
    if (!b && e !== "phy") throw new Error(`${src}.${e} missing`)
    if (b) await Deno.writeFile(`${dst}.${e}`, e === "mdl" ? normalizeMdl(b) : b)
  }
}
// extracts models/<path>.* from a game VPK and decompiles it into <dir>/dec
const gameModel = async (vpk: string, path: string, dir: string) => {
  const name = path.split("/").pop()!
  await deno("vpkx.ts", [vpk, `^models/${path}\\.(mdl|vvd|dx90\\.vtx|phy)$`, dir])
  await decompile(`${dir}/${name}.mdl`, `${dir}/dec`)
}

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
    await cg("player", "PM")
    await Deno.copyFile(`${d}/bmdm_male_anims.mdl`, W("cg/models/player/BMDM_male_anims.mdl"))
    await copyTree(W("gma/materials"), W("cg/materials"))
  },
  // player model: addon meshes posed on the Black Mesa skeleton, compiled once and installed under every player model path
  async pm() {
    const smd = ["body", "face", "hair", "ear", "halo", "T_cloth_0", "T_cloth_1", "T_cloth_1_2", "T_cloth_1_3", "shoes", "nike_pm_physics"].map((n) => `dec/red/${n}.smd`)
    await Deno.mkdir(W("dec/pm"), { recursive: true })
    await deno("retarget.ts", ["pose", "bmsp/dec/base_male_combat_nohands.smd", "-", "dec/pm", ...smd])
    await deno("dropdegen.ts", ["dec/pm"])
    await deno("proportions.ts", ["dec/pm/body.smd", "bmsp/dec/base_male_combat_nohands.smd", "dec/pm"])
    await deno("mkplayerqc.ts", ["bms", "dec/out/nike_pm.qc", "bmsp/dec/mp_scientist_hev.qc", "dec/pm/player.qc"])
    await deno("compile.ts", [W("dec/pm"), "player.qc", W("out10"), "PM"])
  },
  async install() {
    const names = ["pm/nike_pm", "player/mp_scientist_hev", "Player/mp_scientist_hev", "player", "humans/hev_gordon", "humans/hev_male", "humans/hev_male_xen"]
    for (const n of names) await installModel(W("out10/nike_player"), `${cfg.out}/models/${n}`)
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
    const missing = [...want.keys()].filter((f) => !got.has(f)), extra = [...got.keys()].filter((f) => !want.has(f))
    const differ = [...want].filter(([f, h]) => got.has(f) && got.get(f) !== h).map(([f]) => f)
    const bad = missing.concat(extra, differ.filter((f) => !model(f)))
    for (const f of differ.filter(model)) console.warn(`warning: ${f} differs from manifest.sha256 (studiomdl output varies between runs)`)
    if (bad.length) throw new Error(`${bad.length} files missing, unexpected or different from manifest.sha256:\n${bad.join("\n")}`)
    console.log(`${got.size - differ.length} of ${got.size} files match manifest.sha256`)
  },
  // Half-Life 2: the female citizen animations the addon uses in Garry's Mod, and the Black Mesa build's Niko materials
  async "hl2-static"() {
    await deno("vpkx.ts", [`${cfg.hl2}/hl2/hl2_misc_dir.vpk`, "^models/humans/female_(shared|postures|gestures|ss)\\.mdl$", W("hl2/hum")])
    await cg("humans")
    for (const e of Deno.readDirSync(W("hl2/hum"))) await Deno.copyFile(W(`hl2/hum/${e.name}`), W(`cg/models/humans/${e.name}`))
    await copyTree(`${cfg.out}/materials/atri`, `${cfg.outHl2}/materials/atri`)
  },
  // player.mdl: the reduced addon model on its own skeleton, animated by the HL2 female citizen animations
  async "hl2-pm"() {
    await copyTree(W("dec/red"), W("dec/hl2pm"))
    await deno("dropdegen.ts", ["dec/hl2pm"])
    await deno("mkplayerqc.ts", ["hl2", "dec/out/nike_pm.qc", "dec/hl2pm/player.qc"])
    await deno("compile.ts", [W("dec/hl2pm"), "player.qc", W("hl2pm-out"), ""])
    await installModel(W("hl2pm-out/player"), `${cfg.outHl2}/models/player`)
  },
  // viewmodels: the addon's arms replace the hands of every Half-Life 2 weapon
  async "hl2-weapons"() {
    // v_pistol first: the rigid-hand viewmodels take its arms
    const ws = ["v_pistol", "v_357", "v_bugbait", "v_crossbow", "v_crowbar", "v_grenade", "v_hands", "v_irifle", "v_physcannon", "v_rpg", "v_shotgun", "v_slam", "v_smg1", "v_stunstick", "v_superphyscannon"]
    await cg("weapons")
    const out = await sh("deno", ["run", "-A", `${REPO}/tools/weapons.ts`, ...ws], { cwd: cfg.work, env: { GAME: "hl2", HL2: cfg.hl2, OUT: cfg.outHl2 } })
    const bad = out.split("\n").filter((l) => /INCOMPLETE|ERROR/.test(l))
    if (bad.length) throw new Error(`weapons failed:\n${bad.join("\n")}`)
  },
  // MW Base and its shotgun pack: the Model 680 viewmodel, world model and parts
  async mw() {
    await deno("gma.ts", [cfg.mwGma, W("m680/base")])
    await deno("gma.ts", [cfg.mwSgGma, W("m680/sg")])
    const mdls = {
      v: "sg/models/viper/mw/weapons/v_romeo870", "att/w_romeo870": "sg/models/viper/mw/weapons/w_romeo870",
      "att/attachment_vm_holo_west_lod0": "base/models/viper/mw/attachments/attachment_vm_holo_west_lod0",
      ...Object.fromEntries(["receiver", "barrel", "pump"].map((p) => [`att/attachment_vm_sh_romeo870_${p}`, `sg/models/viper/mw/attachments/romeo870/attachment_vm_sh_romeo870_${p}`])),
    }
    for (const [d, src] of Object.entries(mdls)) {
      const dir = W(`m680/dec/${d}`), stem = src.split("/").pop()!, from = W(`m680/${src.slice(0, src.lastIndexOf("/"))}`)
      await Deno.mkdir(dir, { recursive: true })
      for (const e of Deno.readDirSync(from)) if (e.name.startsWith(`${stem}.`)) await Deno.copyFile(`${from}/${e.name}`, `${dir}/${e.name}`)
      await decompile(`${dir}/${stem}.mdl`, `${dir}/dec`)
    }
  },
  // v_shotgun and w_shotgun for each game, built on that game's own models, with the Niko arms and materials of the niko build
  async m680() {
    await cg("weapons")
    const games = { bms: `${cfg.bms}/bms_models_dir.vpk`, hl2: `${cfg.hl2}/hl2/hl2_misc_dir.vpk` }
    for (const [g, vpk] of Object.entries(games)) {
      for (const w of ["v_shotgun", "w_shotgun"]) await gameModel(vpk, `weapons/${w}`, W(`m680/game/${g}/${w}`))
      const d = W(`m680/${g}`), dst = `${cfg.outM680}/${g}`
      await deno("m680.ts", [g, `m680/game/${g}/v_shotgun/dec/v_shotgun.qc`, `m680/game/${g}/w_shotgun/dec/w_shotgun.qc`, "arms/na/dec/Arms.smd", `m680/${g}`, "m680/sg", "m680/base", cfg.out])
      await deno("compile.ts", [d, "v_shotgun.qc", `${d}/out`, "weapons"])
      await deno("compile.ts", [`${d}/w`, "w_shotgun.qc", `${d}/wout`, "weapons"])
      for (const w of ["v_shotgun", "w_shotgun"]) await installModel(`${d}/${w === "v_shotgun" ? "out" : "wout"}/${w}`, `${dst}/models/weapons/${w}`)
      await copyTree(`${d}/materials`, `${dst}/materials`)
    }
  },
}
const targets: Record<string, string[]> = {
  niko: ["gma", "static", "materials", "pm-red", "bms", "pm", "install", "weapons", "verify"],
  "niko-hl2": ["hl2-static", "hl2-pm", "hl2-weapons"],
  m680: ["mw", "m680"],
}

const want = (Deno.args.length ? Deno.args : ["niko"]).flatMap((a) => targets[a] ?? [a])
await Deno.mkdir(cfg.work, { recursive: true })
for (const s of want) { console.log(`== ${s}`); await (stages[s] ?? (() => { throw new Error(`unknown stage ${s}`) }))() }
