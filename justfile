# SPDX-FileCopyrightText: 2026 scarf
# SPDX-License-Identifier: AGPL-3.0-only

# rebuild custom/niko from the Workshop addon and the installed Black Mesa into work/out, then check it against manifest.sha256
build:
    deno run -A tools/build.ts

# copy the build into Black Mesa (set STEAM or BMS, and OUT if the build used it, to match the build)
install: build
    cp -a "${OUT:-work/out}/." "${BMS:-${STEAM:-$HOME/.local/share/Steam}/steamapps/common/Black Mesa/bms}/custom/niko/"
