# SPDX-FileCopyrightText: 2026 scarf
# SPDX-License-Identifier: AGPL-3.0-only

steam := env("STEAM", env("HOME") / ".local/share/Steam")
bms := env("BMS", steam / "steamapps/common/Black Mesa/bms")
hl2 := env("HL2", steam / "steamapps/common/Half-Life 2")

# rebuild custom/niko from the Workshop addon and the installed Black Mesa into work/out, then check it against manifest.sha256
build:
    deno run -A tools/build.ts

# copy the build into Black Mesa (set STEAM or BMS, and OUT if the build used it, to match the build)
install: build
    cp -a "${OUT:-work/out}/." "{{bms}}/custom/niko/"

# the Half-Life 2 Niko mod into work/out-hl2 (needs the Black Mesa build for its materials and arms)
build-hl2: build
    deno run -A tools/build.ts niko-hl2

# copy it into Half-Life 2 (set STEAM or HL2, and OUT_HL2 if the build used it)
install-hl2: build-hl2
    mkdir -p "{{hl2}}/hl2/custom/niko"
    cp -a "${OUT_HL2:-work/out-hl2}/." "{{hl2}}/hl2/custom/niko/"

# the Model 680 mod for both games into work/out-m680/{bms,hl2} (needs the Black Mesa build for the Niko arms)
build-m680: build
    deno run -A tools/build.ts m680

# copy it into Black Mesa and Half-Life 2
install-m680: build-m680
    mkdir -p "{{bms}}/custom/m680" "{{hl2}}/hl2/custom/m680"
    cp -a "${OUT_M680:-work/out-m680}/bms/." "{{bms}}/custom/m680/"
    cp -a "${OUT_M680:-work/out-m680}/hl2/." "{{hl2}}/hl2/custom/m680/"
