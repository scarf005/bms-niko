# Black Mesa Niko

Port of the Garry's Mod addon "[Blue Archive] SRT- Niko - PM&NPC" to Black Mesa and Half-Life 2, in two mods:

- `niko`: Niko as the player model, and her arms on every weapon viewmodel. Black Mesa also gets her on the multiplayer and HEV player models.
- `m680`: the Model 680 shotgun with the Corp Combat Holo sight from Garry's Mod's Modern Warfare 2019 SWEPs, held by Niko's arms, in place of the shotgun (first-person and world model). It works alone or on top of `niko`.

This repository holds only the porting tools. The model files are not included: the build makes them from your own copies of the addons and the games.

| Command | Result | Installs into |
| --- | --- | --- |
| `just install` | `niko` for Black Mesa | `Black Mesa/bms/custom/niko` |
| `just install-hl2` | `niko` for Half-Life 2 | `Half-Life 2/hl2/custom/niko` |
| `just install-m680` | `m680` for both games | `Black Mesa/bms/custom/m680`, `Half-Life 2/hl2/custom/m680` |

`models/Player` and `models/player` in the Black Mesa build hold the same files because the Linux filesystem is case-sensitive; on Windows or macOS keep one of them.

Both games draw viewmodels at a field of view of 54 and Garry's Mod at 64, so the Model 680 looks bigger and closer than in Garry's Mod. Its holo sight shows no reticle: Garry's Mod draws it from Lua.

## Build

`just build` rebuilds the Black Mesa `niko` mod into `work/out` and checks every file against `manifest.sha256`. Textures, materials and NPC/arms models come out byte-identical to my installed copy. studiomdl is not fully deterministic, so model files are compared with their runtime pointers and compile checksum masked, and a mismatch there is only a warning; 12 of the 190 files (viewmodel `.vvd`/`.vtx`/`.mdl`) differ from my installed copy in header bytes.

`just build-hl2` and `just build-m680` run that build first, then make `work/out-hl2` and `work/out-m680`. The `install` recipes copy a build into the games.

Needs [Deno](https://deno.com), [just](https://just.systems), wine with xvfb, inotify-tools, [Crowbar command line](https://github.com/UltraTechX/Crowbar-Command-Line) and Source SDK Base 2013 Multiplayer (for `studiomdl.exe`). Subscribe to the Workshop items first: [Niko](https://steamcommunity.com/sharedfiles/filedetails/?id=3263112279), and for `m680` also [Modern Warfare 2019 SWEPs - Shotguns](https://steamcommunity.com/sharedfiles/filedetails/?id=2751323984) and [MW Base](https://steamcommunity.com/sharedfiles/filedetails/?id=2459720887). Paths come from environment variables, see the top of `tools/build.ts` (`STEAM`, `BMS`, `HL2`, `GMA`, `MW_GMA`, `MW_SG_GMA`, `SDK`, `CROWBAR`, `WINEPREFIX`, `WORK`, `OUT`, `OUT_HL2`, `OUT_M680`).

## Credits

- Model, textures and rigging: the original author, published on [aplaybox](https://www.aplaybox.com/details/model/bgzWCBDl4zFG).
- Garry's Mod addon: [Steam Workshop 3263112279](https://steamcommunity.com/sharedfiles/filedetails/?id=3263112279), by the original uploader.
- Niko and Blue Archive belong to NEXON Korea Corp. and NEXON Games Co., Ltd. I own none of it.
- Model 680 and holo sight models, textures and animations: Call of Duty: Modern Warfare (2019) by Infinity Ward and Activision, as ported to Garry's Mod in Workshop items [2751323984](https://steamcommunity.com/sharedfiles/filedetails/?id=2751323984) and [2459720887](https://steamcommunity.com/sharedfiles/filedetails/?id=2459720887) by their author.
- My part is the port: bone reduction, rebinding to the Black Mesa and Half-Life 2 skeletons, and recompiling the player models and viewmodels.

The original author asks that the Niko Workshop item not be used in publicly shared videos with violence or gore, or with political or religious content.

## Licenses

- `tools/`: the porting scripts, AGPL-3.0-only (`LICENSES/AGPL-3.0-only.txt`).
- Nothing from the addons or from the games is in this repository. The files the build produces are derived from the addons and from Black Mesa and Half-Life 2 models, animations and skeleton data, so all rights in them stay with their authors, Infinity Ward and Activision, Crowbar Collective and Valve. This repository grants no license to them.

## Disclaimer

Unofficial fan port. Not affiliated with or endorsed by Nexon, Activision, Crowbar Collective or Valve. The games are not included. Rights holders can reach me at greenscarf005@gmail.com. Provided as is, without warranty.
