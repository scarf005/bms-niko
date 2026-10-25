# Black Mesa Niko

Port of the Garry's Mod addon "[Blue Archive] SRT- Niko - PM&NPC" to Black Mesa. It replaces the player model, the first-person arms and the weapon viewmodels with Niko.

Install: copy `custom/niko` to `Black Mesa/bms/custom/niko`. `models/Player` and `models/player` hold the same files because the Linux filesystem is case-sensitive; on Windows or macOS keep one of them.

## Credits

- Model, textures and rigging: the original author, published on [aplaybox](https://www.aplaybox.com/details/model/bgzWCBDl4zFG).
- Garry's Mod addon: [Steam Workshop 3263112279](https://steamcommunity.com/sharedfiles/filedetails/?id=3263112279), by the original uploader.
- Niko and Blue Archive belong to NEXON Korea Corp. and NEXON Games Co., Ltd. I own none of it.
- My part is the port: bone reduction, rebinding to the Black Mesa skeleton, and recompiling the player model and viewmodels.

The original author asks that the Workshop item not be used in publicly shared videos with violence or gore, or with political or religious content.

## Licenses

- `tools/`: the porting scripts, AGPL-3.0-only (`LICENSES/AGPL-3.0-only.txt`).
- `custom/` and everything else derived from the addon: all rights stay with the original author and rights holders. The viewmodels and player models also embed animation and skeleton data from Black Mesa, which belongs to Crowbar Collective and Valve. This repository grants no license to any of it.

## Disclaimer

Unofficial fan port. Not affiliated with or endorsed by Nexon, Crowbar Collective or Valve. The game itself is not included. The addon content is redistributed without the original author's confirmation, and I will remove it if the rights holders ask: greenscarf005@gmail.com. Provided as is, without warranty.
