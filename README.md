# Black Mesa Niko

Port of the Garry's Mod addon "[Blue Archive] SRT- Niko - PM&NPC" to Black Mesa. It replaces the player model, the first-person arms and the weapon viewmodels with Niko.

This repository holds only the porting tools. The model files are not included: `just build` makes them from your own copy of the addon and of Black Mesa, and `just install` puts them in `Black Mesa/bms/custom/niko`. `models/Player` and `models/player` hold the same files because the Linux filesystem is case-sensitive; on Windows or macOS keep one of them.

## Build

`just build` rebuilds the mod from your own copies of the addon and Black Mesa into `work/out` and checks every file against `manifest.sha256`. Textures, materials and NPC/arms models come out byte-identical to my installed copy. studiomdl is not fully deterministic, so model files are compared with their runtime pointers and compile checksum masked, and a mismatch there is only a warning; 12 of the 190 files (viewmodel `.vvd`/`.vtx`/`.mdl`) differ from my installed copy in header bytes. `just install` copies the result into Black Mesa.

Needs [Deno](https://deno.com), [just](https://just.systems), wine with xvfb, inotify-tools, [Crowbar command line](https://github.com/UltraTechX/Crowbar-Command-Line) and Source SDK Base 2013 Multiplayer (for `studiomdl.exe`). Subscribe to the Workshop item first. Paths come from environment variables, see the top of `tools/build.ts` (`STEAM`, `BMS`, `GMA`, `SDK`, `CROWBAR`, `WINEPREFIX`, `WORK`, `OUT`).

## Credits

- Model, textures and rigging: the original author, published on [aplaybox](https://www.aplaybox.com/details/model/bgzWCBDl4zFG).
- Garry's Mod addon: [Steam Workshop 3263112279](https://steamcommunity.com/sharedfiles/filedetails/?id=3263112279), by the original uploader.
- Niko and Blue Archive belong to NEXON Korea Corp. and NEXON Games Co., Ltd. I own none of it.
- My part is the port: bone reduction, rebinding to the Black Mesa skeleton, and recompiling the player model and viewmodels.

The original author asks that the Workshop item not be used in publicly shared videos with violence or gore, or with political or religious content.

## Licenses

- `tools/`: the porting scripts, AGPL-3.0-only (`LICENSES/AGPL-3.0-only.txt`).
- Nothing from the addon or from Black Mesa is in this repository. The files `just build` produces are derived from the addon and from Black Mesa animation and skeleton data, so all rights in them stay with the original author, Crowbar Collective and Valve. This repository grants no license to them.

## Disclaimer

Unofficial fan port. Not affiliated with or endorsed by Nexon, Crowbar Collective or Valve. The game itself is not included. Rights holders can reach me at greenscarf005@gmail.com. Provided as is, without warranty.
